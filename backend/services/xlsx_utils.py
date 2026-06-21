"""Shared utilities for xlsx parsing used by scripts and services."""

import re
from datetime import datetime
from pathlib import Path


def sf(v):
    """Safe float conversion — handles None, empty strings, and comma-separated values."""
    if v is None or str(v).strip() in ('', '-', '--'):
        return 0.0
    return float(str(v).replace(',', '').replace(' ', ''))


def parse_datetime(s):
    """Try to parse a datetime from string or datetime object across multiple formats."""
    if isinstance(s, datetime):
        return s
    if not s:
        return None
    s = str(s).strip()
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M:%S",
                "%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"]:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


# Category normalisation map: xlsx raw names → standard categories
CAT_NORM = {
    "购物": "购物（网购）", "网购": "购物（网购）", "网购-美妆": "购物（网购）",
    "日用百货": "购物（网购）", "家居家装": "购物（网购）", "服饰美容": "购物（网购）",
    "数码家电": "购物（网购）",
    "餐饮": "餐饮", "餐饮美食": "餐饮",
    "还款": "还款（房贷 信用卡）", "房贷": "还款（房贷 信用卡）",
    "娱乐": "娱乐",
    "生活服务": "生活服务",
    "转账": "转账（红包、人情）", "红包": "转账（红包、人情）",
    "充值缴费": "充值缴费",
    "交通": "交通", "出行": "交通",
    "医疗": "医疗（保险、核酸等）", "保险": "医疗（保险、核酸等）",
    "家庭支出": "家庭支出（装修、大件）", "装修": "家庭支出（装修、大件）",
}

INCOME_NORM = {"工资": "工资", "房租": "房租", "公司": "公司", "理财": "理财收益", "退款": "其他"}


def norm_cat(name: str) -> str:
    """Map xlsx category name to standard category, falling back to original."""
    return CAT_NORM.get(str(name).strip(), str(name).strip())


def detect_month_from_path(path: Path) -> str | None:
    """Try to extract month key (e.g. '2026.5') from a path or filename."""
    name = path.stem if path.is_file() else path.name
    name = name.strip()
    # Strip common prefixes
    name = re.sub(r'家庭收支', '', name)
    m = re.search(r'(\d{4})[.年\-](\d{1,2})', name)
    if m:
        return f"{m.group(1)}.{m.group(2)}"
    return None


def detect_person_from_label(label: str) -> str | None:
    """Detect person code ('BB' or 'LN') from a Chinese label."""
    if not label:
        return None
    if "斌" in label:
        return "BB"
    if "纳" in label or "娜" in label:
        return "LN"
    return None
