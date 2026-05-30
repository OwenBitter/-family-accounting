"""One-click monthly import: parse xlsx/csv + OCR screenshots + write to JSON & Excel.

No Flask dependency — directly operates DataStore and excel_writer.

Usage:
  python3 import_month.py 2026.5              # Import both persons
  python3 import_month.py 2026.5 --skip-ocr   # Skip screenshot processing
  python3 import_month.py 2026.5 --person BB  # Only import one person
  python3 import_month.py 2026.5 --dry-run    # Preview without writing
"""

import os
import sys
import argparse
from pathlib import Path
from datetime import datetime

# Ensure backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config
from models.schemas import MonthlyData, Transaction, IncomeRecord, AssetSnapshot
from services.data_store import DataStore
from services.excel_reader import parse_alipay_csv, parse_wechat_xlsx
from services.excel_writer import create_monthly_book
from services.classifier import classify, classify_income

# ─── Helpers ──────────────────────────────────────────────────────────

PERSON_DIR_ALIASES = {
    "BB": ["BB", "bb", "斌"],
    "LN": ["LN", "ln", "xzb", "纳", "娜"],
}

ALIAS_TO_CODE = {}
for code, names in PERSON_DIR_ALIASES.items():
    for n in names:
        ALIAS_TO_CODE[n.lower()] = code


def resolve_person_dir_name(person_code: str) -> list[str]:
    """Get possible directory names for a person code."""
    return PERSON_DIR_ALIASES.get(person_code, [person_code])


def find_person_dir(month_dir: Path, person_code: str) -> Path | None:
    """Find a person's subdirectory inside the month folder."""
    candidates = resolve_person_dir_name(person_code)
    for cand in candidates:
        cand_path = month_dir / cand
        if cand_path.is_dir():
            return cand_path
    return None


def find_files(dir_path: Path, extensions: set[str]) -> list[Path]:
    """Find files with given extensions in a directory (non-recursive)."""
    result = []
    for ext in extensions:
        result.extend(sorted(dir_path.glob(f"*{ext}")))
        result.extend(sorted(dir_path.glob(f"*{ext.upper()}")))
    return sorted(set(result), key=lambda p: p.name)


def month_from_folder_name(folder_name: str) -> str | None:
    """Try to extract 'YYYY.M' from a folder name."""
    import re
    m = re.search(r'(\d{4})[.\-年](\d{1,2})', folder_name)
    if m:
        return f"{m.group(1)}.{m.group(2)}"
    return None


# ─── OCR integration ──────────────────────────────────────────────────

def run_ocr_for_person(person_dir: Path, person_code: str) -> dict:
    """Run OCR on all screenshots in a person's directory.

    Returns:
        dict with asset fields extracted from OCR, or empty dict on failure.
    """
    img_exts = {".png", ".jpg", ".jpeg"}
    images = find_files(person_dir, img_exts)
    if not images:
        return {}

    try:
        # Use Tesseract-based OCR from ocr_analyze.py
        # Set env as ocr_analyze.py does
        os.environ.setdefault("TESSDATA_PREFIX", os.path.expanduser("~/tessdata"))

        import pytesseract
        from PIL import Image, ImageEnhance

        # Tesseract path — try WSL path first, then Windows
        tesseract_paths = [
            "/usr/bin/tesseract",
            "/usr/local/bin/tesseract",
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"/mnt/c/Program Files/Tesseract-OCR/tesseract.exe",
        ]
        tesseract_cmd = None
        for tp in tesseract_paths:
            if os.path.exists(tp):
                tesseract_cmd = tp
                break

        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        else:
            print("  [WARN] Tesseract not found, skipping OCR")
            return {}

        all_assets = {}

        for img_path in images:
            print(f"  OCR: {img_path.name}...")
            try:
                img = Image.open(img_path)
                w, h = img.size

                # Scale up for better recognition
                scale = 3
                results = []
                for top in range(0, h - 40, 40):
                    bot = min(top + 80, h)
                    crop = img.crop((0, top, w, bot)).convert("L")
                    crop = crop.resize((crop.width * scale, crop.height * scale), Image.LANCZOS)
                    crop = ImageEnhance.Contrast(crop).enhance(2.5)
                    crop = ImageEnhance.Sharpness(crop).enhance(3.0)
                    text = pytesseract.image_to_string(crop, lang="chi_sim+eng", config="--psm 6")
                    for line in text.split("\n"):
                        line = line.strip()
                        if len(line) > 1:
                            results.append((top, line))

                all_text = " ".join(t for _, t in results)

                # Detect platform
                is_alipay = sum(1 for kw in ["余额宝", "基金", "支付宝", "总资产"] if kw in all_text)
                is_wechat = sum(1 for kw in ["零钱", "零钱通", "微信", "钱包"] if kw in all_text)

                # Extract amounts from text
                import re
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

                # Extract asset fields
                if is_alipay >= is_wechat:
                    for y, text in results:
                        if "余额宝" in text:
                            for y2, val, ctx in amounts:
                                if abs(y2 - y) < 100:
                                    all_assets.setdefault("alipay_yuebao", val)
                        if "基金" in text:
                            for y2, val, ctx in amounts:
                                if abs(y2 - y) < 100:
                                    all_assets.setdefault("alipay_fund", val)
                    # "余额" but not "余额宝"
                    for y, text in results:
                        if "余额" in text and "余额宝" not in text:
                            for y2, val, ctx in amounts:
                                if abs(y2 - y) < 100 and val > 1:
                                    all_assets.setdefault("alipay_balance", val)

                if is_wechat >= is_alipay:
                    for y, val, ctx in amounts:
                        if "零钱" in ctx and "通" not in ctx:
                            all_assets.setdefault("wechat_balance", val)
                        if "零钱通" in ctx:
                            all_assets.setdefault("wechat_licaitong", val)

            except Exception as e:
                print(f"  [WARN] OCR failed for {img_path.name}: {e}")

        return all_assets

    except ImportError:
        print("  [WARN] pytesseract/PIL not available, skipping OCR")
        return {}


# ─── Core logic ───────────────────────────────────────────────────────

def import_month(month: str, skip_ocr: bool = False, person_filter: str | None = None,
                 dry_run: bool = False):
    """Import one month's data from bills directory.

    Args:
        month: Month key like "2026.5"
        skip_ocr: If True, skip screenshot OCR
        person_filter: If set, only import this person ("BB" or "LN")
        dry_run: If True, parse and classify but don't write
    """
    bill_dir = config.BILL_DIR

    # Find the month folder
    month_dir = None
    if bill_dir.exists():
        for sub in bill_dir.iterdir():
            if sub.is_dir():
                detected = month_from_folder_name(sub.name)
                if detected == month:
                    month_dir = sub
                    break
        # Also try direct month name
        direct = bill_dir / month
        if direct.is_dir():
            month_dir = direct

    if not month_dir or not month_dir.exists():
        print(f"Error: Bill folder for {month} not found under {bill_dir}")
        print(f"Expected: {bill_dir / month}")
        return 1

    print(f"=== Importing {month} ===")
    print(f"Source: {month_dir}")

    # Determine which persons to process
    persons = [person_filter] if person_filter else config.PERSONS

    # Load or create monthly data
    data_store = DataStore(config.HISTORY_DIR)
    monthly = data_store.get_month(month)
    if monthly is None:
        monthly = MonthlyData(month=month)

    # Stats
    stats = {}

    for person_code in persons:
        print(f"\n--- {person_code} ---")

        # Find person's subdirectory
        person_dir = find_person_dir(month_dir, person_code)
        if not person_dir:
            # Maybe files are directly in the month folder?
            # Check if there are CSV/xlsx without person subdirs
            csv_files = find_files(month_dir, {".csv"})
            xlsx_files = find_files(month_dir, {".xlsx"})
            if csv_files or xlsx_files:
                person_dir = month_dir  # Files directly in month folder
            else:
                print(f"  No data directory for {person_code}, skipping")
                stats[person_code] = {"expenses": 0, "income": 0, "assets": 0}
                continue

        all_transactions: list[Transaction] = []

        # ── Step 1: Parse CSV files (Alipay) ──
        csv_files = find_files(person_dir, {".csv"})
        if csv_files:
            print(f"  Found {len(csv_files)} CSV file(s)")
            for fp in csv_files:
                print(f"    Parsing: {fp.name}")
                txns = parse_alipay_csv(str(fp), person=person_code, auto_detect=False)
                all_transactions.extend(txns)

        # ── Step 2: Parse XLSX files (WeChat) ──
        xlsx_files = find_files(person_dir, {".xlsx"})
        if xlsx_files:
            print(f"  Found {len(xlsx_files)} XLSX file(s)")
            for fp in xlsx_files:
                # Skip files that look like account books (not wechat exports)
                fname = fp.name.lower()
                if "家庭收支" in fname or "account" in fname:
                    print(f"    Skipping account book: {fp.name}")
                    continue
                print(f"    Parsing: {fp.name}")
                try:
                    txns = parse_wechat_xlsx(str(fp), person=person_code, auto_detect=False)
                    all_transactions.extend(txns)
                except Exception as e:
                    print(f"    [WARN] Failed to parse {fp.name}: {e}")

        # ── Step 3: Classify all transactions ──
        expense_count = 0
        income_count = 0
        for t in all_transactions:
            if t.amount > 0:
                t.target_category = classify_income(t.description, t.counterparty)
            else:
                t.target_category = classify(t.source, t.raw_category,
                                             t.description, t.amount)

            # Skip special markers
            if t.target_category in ("__skip__",):
                continue

        # Separate into expenses and income
        new_expenses = [t for t in all_transactions if t.amount < 0]
        new_income = [t for t in all_transactions if t.amount > 0]

        expense_count = len(new_expenses)
        income_count = len(new_income)

        # ── Step 4: Add to monthly data ──
        # Remove old entries for this person (replace, not append)
        monthly.expenses[person_code] = new_expenses
        monthly.income[person_code] = [
            IncomeRecord(
                person=person_code,
                time=t.time,
                category=t.target_category or "其他",
                amount=t.amount,
                channel="支付宝" if t.source == "alipay" else "微信",
                account=t.counterparty,
                note=t.description,
            )
            for t in new_income
        ]

        # ── Step 5: OCR screenshots ──
        if not skip_ocr and person_dir != month_dir:
            ocr_results = run_ocr_for_person(person_dir, person_code)
            if ocr_results:
                print(f"  OCR found: {ocr_results}")
                asset = AssetSnapshot(
                    person=person_code,
                    month=month,
                    alipay_fund=ocr_results.get("alipay_fund", 0),
                    alipay_yuebao=ocr_results.get("alipay_yuebao", 0),
                    alipay_balance=ocr_results.get("alipay_balance", 0),
                    wechat_balance=ocr_results.get("wechat_balance", 0),
                    wechat_licaitong=ocr_results.get("wechat_licaitong", 0),
                )
                monthly.assets[person_code] = asset
                monthly.last_balance[person_code] = asset.total

        stats[person_code] = {
            "expenses": expense_count,
            "income": income_count,
            "assets": round(monthly.assets.get(person_code).total, 2)
            if monthly.assets.get(person_code) else 0,
        }

        print(f"  => {expense_count} expenses, {income_count} income records")

    # ── Print summary ──
    print(f"\n=== Summary for {month} ===")
    for person_code in persons:
        s = stats.get(person_code, {})
        print(f"  {person_code}: {s.get('expenses', 0)} expenses, "
              f"{s.get('income', 0)} income, "
              f"assets ¥{s.get('assets', 0):,.2f}")

    if dry_run:
        print("\n[Dry run — no data written]")
        return 0

    # ── Step 6: Write to DataStore + Excel ──
    print(f"\nWriting data...")
    try:
        file_path = create_monthly_book(month, monthly)
        print(f"  Excel written: {file_path}")
    except Exception as e:
        print(f"  [ERROR] Excel write failed: {e}")
        return 1

    data_store.save_month(month, monthly)
    data_store.rebuild_index()
    print(f"  JSON cache updated: {data_store._month_path(month)}")
    print(f"\nDone! {month} imported successfully.")

    return 0


# ─── CLI ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="One-click monthly import: parse bills + OCR + write"
    )
    parser.add_argument(
        "month",
        help="Month to import, e.g. '2026.5'",
    )
    parser.add_argument(
        "--skip-ocr",
        action="store_true",
        help="Skip screenshot OCR processing",
    )
    parser.add_argument(
        "--person",
        choices=["BB", "LN"],
        help="Only import one person",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and classify without writing",
    )
    parser.add_argument(
        "--bill-dir",
        help="Override bill directory (default: config.BILL_DIR)",
    )
    args = parser.parse_args()

    if args.bill_dir:
        config.BILL_DIR = Path(args.bill_dir)

    sys.exit(import_month(
        month=args.month,
        skip_ocr=args.skip_ocr,
        person_filter=args.person,
        dry_run=args.dry_run,
    ))


if __name__ == "__main__":
    main()
