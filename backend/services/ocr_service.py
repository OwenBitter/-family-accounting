"""OCR service for recognizing financial screenshots.

Uses EasyOCR as primary engine. Falls back gracefully if models unavailable.
"""

import re
from io import BytesIO
from typing import Optional

from PIL import Image, ImageEnhance

from config import ALIPAY_ACCOUNTS, WECHAT_NICKNAMES

_ocr_reader = None
_ocr_available = True


def _get_reader():
    global _ocr_reader, _ocr_available
    if _ocr_reader is None and _ocr_available:
        # Check if model files exist before attempting
        import os
        model_dir = os.path.expanduser("~/.EasyOCR/model")
        craft_file = os.path.join(model_dir, "craft_mlt_25k.pth")
        if not os.path.exists(craft_file):
            _ocr_available = False
            return None
        try:
            import easyocr
            _ocr_reader = easyocr.Reader(["ch_sim", "en"], gpu=False)
        except Exception:
            _ocr_available = False
    return _ocr_reader


def preprocess_image(image: Image.Image) -> Image.Image:
    """Enhance image for better OCR."""
    img = image.convert("RGB")
    img = ImageEnhance.Contrast(img).enhance(1.5)
    img = ImageEnhance.Sharpness(img).enhance(1.2)
    return img


def classify_screenshot(ocr_results: list) -> str:
    """Classify screenshot type from OCR text results."""
    all_text = " ".join([text for _, text, _ in ocr_results])

    alipay_score = sum(1 for kw in ["余额", "余额宝", "支付宝", "基金", "总金额"]
                       if kw in all_text)
    wechat_score = sum(1 for kw in ["零钱", "零钱通", "微信", "钱包"]
                       if kw in all_text)
    bank_score = sum(1 for kw in ["卡号", "持卡人", "可用余额", "活期", "开户行"]
                     if kw in all_text)

    scores = {"alipay": alipay_score, "wechat": wechat_score, "bank_card": bank_score}
    best = max(scores, key=scores.get)
    return best if scores[best] >= 2 else "unknown"


def find_amount_near_keyword(ocr_results: list, keyword: str,
                             max_dist: int = 300) -> Optional[dict]:
    """Find a numeric amount near the keyword's bounding box."""
    keyword_boxes = []
    amount_candidates = []

    for bbox, text, conf in ocr_results:
        text_clean = text.strip()

        if keyword in text_clean:
            keyword_boxes.append({
                "bbox": bbox,
                "conf": conf,
                "text": text_clean,
            })

        amount = _parse_amount(text_clean)
        if amount is not None:
            cx = (bbox[0][0] + bbox[2][0]) / 2
            cy = (bbox[0][1] + bbox[2][1]) / 2
            amount_candidates.append({
                "bbox": bbox,
                "cx": cx,
                "cy": cy,
                "amount": amount,
                "conf": conf,
                "raw_text": text_clean,
            })

    if not keyword_boxes or not amount_candidates:
        return None

    # Pick the keyword box with smallest Y (topmost)
    kbox = min(keyword_boxes, key=lambda k: k["bbox"][0][1])

    # Find nearest amount
    kx = (kbox["bbox"][0][0] + kbox["bbox"][2][0]) / 2
    ky = (kbox["bbox"][0][1] + kbox["bbox"][2][1]) / 2

    def distance(a):
        return ((a["cx"] - kx) ** 2 + (a["cy"] - ky) ** 2) ** 0.5

    # Filter: amount should be to the right or below the keyword
    nearby = [
        a for a in amount_candidates
        if a["cx"] > kx - 50 and a["cy"] > ky - 50
        and distance(a) < max_dist
    ]

    if not nearby:
        return None

    best = min(nearby, key=distance)
    return {
        "amount": best["amount"],
        "confidence": best["conf"],
        "raw_text": best["raw_text"],
    }


def detect_person_from_text(ocr_results: list) -> Optional[str]:
    """Detect person from account identifiers in OCR text."""
    all_text = " ".join([text for _, text, _ in ocr_results])

    for person, info in {**ALIPAY_ACCOUNTS, **WECHAT_NICKNAMES}.items():
        for kw in info["keywords"]:
            if kw.lower() in all_text.lower():
                return person
    return None


def process_screenshot(image_data: bytes) -> dict:
    """Process a single screenshot image and extract financial data.

    Args:
        image_data: Raw image bytes

    Returns:
        dict with extracted financial fields, confidence, and person detection
    """
    reader = _get_reader()

    # Load and preprocess
    img = Image.open(BytesIO(image_data))

    # Resize if too large
    max_dim = 2000
    if max(img.size) > max_dim:
        ratio = max_dim / max(img.size)
        new_size = (int(img.width * ratio), int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    img_enhanced = preprocess_image(img)
    img_bytes = BytesIO()
    img_enhanced.save(img_bytes, format="PNG")
    img_bytes.seek(0)

    # OCR
    results = []
    if reader:
        try:
            results = reader.readtext(img_bytes.getvalue())
        except Exception:
            results = []

    if not results:
        return {"channel": "unknown", "fields": {}, "confidence": 0, "detected_person": None,
                "note": "OCR 模型未加载，请在页面中手动输入金额" if not _ocr_available else ""}

    # Classify screenshot type
    channel = classify_screenshot(results)

    # Detect person
    detected_person = detect_person_from_text(results)

    # Extract fields based on type
    fields = {}
    confidences = []

    if channel == "alipay":
        for kw, field_name in [
            ("基金", "alipay_fund"),
            ("余额宝", "alipay_yuebao"),
        ]:
            result = find_amount_near_keyword(results, kw)
            if result:
                fields[field_name] = result["amount"]
                confidences.append(result["confidence"])

        # Balance: find "余额" but NOT "余额宝"
        balance_result = find_amount_near_keyword(results, "余额")
        if balance_result:
            fields["alipay_balance"] = balance_result["amount"]
            confidences.append(balance_result["confidence"])

    elif channel == "wechat":
        result = find_amount_near_keyword(results, "零钱")
        if result:
            fields["wechat_balance"] = result["amount"]
            confidences.append(result["confidence"])

        lc_result = find_amount_near_keyword(results, "零钱通")
        if lc_result:
            fields["wechat_licaitong"] = lc_result["amount"]
            confidences.append(lc_result["confidence"])

    elif channel == "bank_card":
        result = find_amount_near_keyword(results, "可用余额")
        if not result:
            result = find_amount_near_keyword(results, "活期余额")
        if result:
            fields["bank_balance"] = result["amount"]
            confidences.append(result["confidence"])

    # Calculate overall confidence
    avg_conf = sum(confidences) / len(confidences) if confidences else 0
    overall_conf = min(avg_conf, 1.0)

    return {
        "channel": channel,
        "fields": fields,
        "confidence": round(overall_conf, 4),
        "detected_person": detected_person,
        "raw_results": [
            {"text": text, "confidence": round(conf, 4)}
            for bbox, text, conf in results
        ],
    }


def _parse_amount(text: str) -> Optional[float]:
    """Extract a monetary amount from text.

    Handles: 1234.56, 1,234.56, ¥1234.56, 5.2万
    """
    text = text.strip()

    # Handle "万" (ten-thousands) unit
    wan_match = re.search(r'(\d+\.?\d*)万', text)
    if wan_match:
        return float(wan_match.group(1)) * 10000

    # Clean up currency symbols and commas
    clean = text.replace("¥", "").replace("￥", "").replace(",", "").strip()
    # Match amount pattern
    match = re.search(r'-?\d+\.?\d{0,2}', clean)
    if match:
        val = float(match.group())
        if 0 < val < 10_000_000:  # sanity check
            return val
    return None
