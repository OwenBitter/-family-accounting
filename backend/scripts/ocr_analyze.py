"""OCR analyze screenshots for financial data extraction.

Uses Tesseract + chi_sim (installed at ~/tessdata/) to extract
asset balances, income records, and other financial data from
Alipay/WeChat/bank card screenshots.

Usage:
  python backend/scripts/ocr_analyze.py <image_path>          # Single image
  python backend/scripts/ocr_analyze.py <folder>              # All images in folder
  python backend/scripts/ocr_analyze.py <image> --json         # JSON output
  python backend/scripts/ocr_analyze.py <folder> --import      # Generate import-ready JSON
"""

import os, re, json, sys
from pathlib import Path

os.environ["TESSDATA_PREFIX"] = os.path.expanduser("~/tessdata")
import pytesseract
from PIL import Image, ImageEnhance

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def ocr_image(img: Image.Image, scale: int = 3, psm: int = 6) -> list[tuple[int, str]]:
    """OCR an image and return sorted (y_position, text) tuples."""
    w, h = img.size
    results = []

    for top in range(0, h - 40, 40):
        bot = min(top + 80, h)
        crop = img.crop((0, top, w, bot)).convert("L")
        crop = crop.resize((crop.width * scale, crop.height * scale), Image.LANCZOS)
        crop = ImageEnhance.Contrast(crop).enhance(2.5)
        crop = ImageEnhance.Sharpness(crop).enhance(3.0)
        text = pytesseract.image_to_string(crop, lang="chi_sim+eng", config=f"--psm {psm}")
        for line in text.split("\n"):
            line = line.strip()
            if len(line) > 1:
                results.append((top, line))

    return results


def extract_amounts(results: list[tuple[int, str]]) -> list[tuple[int, float, str]]:
    """Extract monetary amounts from OCR results."""
    amounts = []
    for y, text in results:
        nums = re.findall(r"[\d,]+\.?\d{0,2}", text)
        for n in nums:
            n = n.replace(",", "")
            try:
                val = float(n)
                if 1 < val < 10_000_000:
                    amounts.append((y, val, text))
            except ValueError:
                pass
    return amounts


def classify_screenshot(results: list[tuple[int, str]], amounts: list[tuple[int, float, str]]) -> dict:
    """Classify screenshot and extract structured financial data."""
    all_text = " ".join(t for _, t in results)

    # Detect platform
    is_alipay = sum(1 for kw in ["余额", "余额宝", "基金", "支付宝", "总资产", "资产"] if kw in all_text)
    is_wechat = sum(1 for kw in ["零钱", "零钱通", "微信", "钱包", "分付"] if kw in all_text)
    is_bank = sum(1 for kw in ["可用余额", "活期", "卡号", "开户行", "持卡人"] if kw in all_text)
    is_income_bill = "收入" in all_text and "年" in all_text

    info = {"type": "unknown", "fields": {}}

    if is_income_bill:
        info["type"] = "income_bill"
        # Extract year-to-date total
        for y, text in results:
            m = re.search(r"(\d{4})\s*年\s*收\s*入[#¥]*\s*([\d,]+\.?\d*)", text)
            if m:
                info["fields"]["year"] = m.group(1)
                info["fields"]["total_income_ytd"] = float(m.group(2).replace(",", ""))
            # Monthly breakdown: "X月" followed by amount
            m2 = re.search(r"(\d{1,2})\s*月", text)
            if m2:
                month = int(m2.group(1))

        # Find monthly income amounts
        for y, val, ctx in amounts:
            for month_num in range(1, 13):
                if f"{month_num}月" in ctx or f"{month_num:02d}" in ctx:
                    info["fields"].setdefault("monthly_income", {})[str(month_num)] = val

    if is_alipay > is_wechat and is_alipay > is_bank:
        info["type"] = "alipay"
        for y, text in results:
            if "余额宝" in text or "余额" in text:
                for y2, val, ctx in amounts:
                    if abs(y2 - y) < 100 and val > 1:
                        info["fields"]["alipay_balance"] = val
            if "基金" in text:
                for y2, val, ctx in amounts:
                    if abs(y2 - y) < 100:
                        info["fields"]["alipay_fund"] = val

    if is_wechat > is_alipay and is_wechat > is_bank:
        info["type"] = "wechat"
        for y, val, ctx in amounts:
            if "零钱" in ctx and "通" not in ctx:
                info["fields"]["wechat_balance"] = val
            if "零钱通" in ctx:
                info["fields"]["wechat_licaitong"] = val

    # Find all significant amounts with context
    for y, val, ctx in amounts:
        if val > 1000:
            info["fields"].setdefault("amounts_detected", []).append({
                "y": y, "amount": val, "context": ctx[:40]
            })

    return info


def analyze(image_path: str) -> dict:
    """Analyze a single image and return structured data."""
    img = Image.open(image_path)
    w, h = img.size

    results = ocr_image(img)
    amounts = extract_amounts(results)
    info = classify_screenshot(results, amounts)

    info["filename"] = Path(image_path).name
    info["image_size"] = f"{w}x{h}"
    info["text_blocks"] = len(results)
    info["amounts_found"] = len(amounts)

    return info


def main():
    import argparse
    parser = argparse.ArgumentParser(description="OCR analyze financial screenshots")
    parser.add_argument("path", help="Image path or folder path")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    parser.add_argument("--import", dest="do_import", action="store_true",
                        help="Generate import-ready JSON for the system")
    args = parser.parse_args()

    path = Path(args.path)
    if path.is_dir():
        images = sorted(f for f in path.rglob("*") if f.suffix.lower() in {".jpg", ".jpeg", ".png"})
    elif path.is_file():
        images = [path]
    else:
        print(f"Error: {path} not found", file=sys.stderr)
        sys.exit(1)

    all_results = []
    for img_path in images:
        result = analyze(str(img_path))
        all_results.append(result)
        if not args.json:
            print(f"\n{'='*50}")
            print(f"File: {result['filename']} ({result['image_size']})")
            print(f"Type: {result['type']}")
            print(f"Fields: {json.dumps(result['fields'], ensure_ascii=False, indent=2)}")

    if args.json:
        print(json.dumps(all_results, ensure_ascii=False, indent=2))

    if args.do_import:
        # Generate import data
        import_data = {"assets": {}, "income": {}}
        for r in all_results:
            f = r["fields"]
            if r["type"] == "income_bill":
                import_data["income"]["total_ytd"] = f.get("total_income_ytd")
            if r["type"] == "wechat":
                import_data["assets"]["wechat_balance"] = f.get("wechat_balance", 0)
                import_data["assets"]["wechat_licaitong"] = f.get("wechat_licaitong", 0)
        print("\n--- Import Data ---")
        print(json.dumps(import_data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
