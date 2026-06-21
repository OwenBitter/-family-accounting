"""One-click monthly import: parse xlsx/csv + write to JSON & Excel.

No Flask dependency — directly operates DataStore and excel_writer.

Usage:
  python3 import_month.py 2026.5              # Import both persons
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
from models.schemas import MonthlyData, Transaction, IncomeRecord
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


def _prev_month_key(month: str) -> str:
    """Return the previous month key, e.g. '2026.5' -> '2026.4'."""
    parts = month.split(".")
    y, m = int(parts[0]), int(parts[1])
    if m == 1:
        return f"{y - 1}.12"
    return f"{y}.{m - 1}"


# ─── Core logic ───────────────────────────────────────────────────────

def import_month(month: str, person_filter: str | None = None,
                 dry_run: bool = False):
    """Import one month's data from bills directory.

    Args:
        month: Month key like "2026.5"
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

        # ── Step 3: Classify and filter all transactions ──
        from config import SKIP_KEYWORDS
        for t in all_transactions:
            # Skip known non-expense transactions (e.g. 小荷包自动攒)
            if t.target_category != "__skip__":
                desc_check = (t.description + " " + (t.raw_category or "")).lower()
                if any(kw.lower() in desc_check for kw in SKIP_KEYWORDS):
                    t.target_category = "__skip__"

            # Classify
            if t.target_category != "__skip__":
                if t.amount > 0:
                    t.target_category = classify_income(t.description, t.counterparty)
                else:
                    t.target_category = classify(t.source, t.raw_category,
                                                 t.description, t.amount, t.counterparty)

                # Skip special markers
                if t.target_category in ("__skip__", "__income__"):
                    t.target_category = "__skip__"

        # Filter out skipped/income transactions, separate by sign
        active_txns = [t for t in all_transactions if t.target_category != "__skip__"]
        new_expenses = [t for t in active_txns if t.amount < 0]
        new_income = [t for t in active_txns if t.amount > 0]

        # ── Step 3b: Remove cancelled orders that have corresponding refunds ──
        # If a transaction was cancelled (交易关闭) and has a matching refund,
        # exclude both the expense and the refund income.
        for t in all_transactions:
            if t.target_category == "__skip__":
                continue
            if t.status == "交易关闭" and t.amount < 0:
                # Look for matching refund in new_income (Transaction objects)
                amt = abs(t.amount)
                for inc in new_income:
                    if abs(inc.amount - amt) < 0.01 and "退款" in (inc.description or ""):
                        t.target_category = "__skip__"
                        inc.target_category = "__skip__"
                        break
        # Re-filter after removing closed+refund pairs
        new_expenses = [t for t in new_expenses if t.target_category != "__skip__"]
        new_income = [t for t in new_income if t.target_category != "__skip__"]

        expense_count = len(new_expenses)
        income_count = len(new_income)

        # ── Step 4: Add expenses to monthly data; merge income ──
        # Merge expenses: keep any existing manual entries, add CSV-derived ones
        existing_expenses = monthly.expenses.get(person_code, [])
        manual_expenses = [t for t in existing_expenses if getattr(t, 'source', '') == 'manual']
        monthly.expenses[person_code] = manual_expenses + new_expenses

        # Merge income: keep existing manual income, add new CSV-derived income
        # Deduplicate by (amount, time, note) to avoid duplicates
        existing_income = monthly.income.get(person_code, [])
        existing_keys = {(abs(r.amount), r.time.isoformat() if hasattr(r.time, 'isoformat') else str(r.time), r.note)
                        for r in existing_income}
        for t in new_income:
            key = (abs(t.amount), t.time.isoformat(), t.description)
            if key not in existing_keys:
                existing_keys.add(key)
                existing_income.append(
                    IncomeRecord(
                        person=person_code,
                        time=t.time,
                        category=t.target_category or "其他",
                        amount=t.amount,
                        channel="支付宝" if t.source == "alipay" else "微信",
                        account=t.counterparty,
                        note=t.description,
                    )
                )
        monthly.income[person_code] = existing_income

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
        description="One-click monthly import: parse bills + write to JSON & Excel"
    )
    parser.add_argument(
        "month",
        help="Month to import, e.g. '2026.5'",
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
        person_filter=args.person,
        dry_run=args.dry_run,
    ))


if __name__ == "__main__":
    main()
