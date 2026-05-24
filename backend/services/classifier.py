"""Expense category mapping engine."""

import re
from typing import Optional

from config import CATEGORY_MAP, KEYWORD_RULES, CATEGORIES


def classify(source: str, raw_category: str, description: str = "",
             amount: float = 0.0, custom_rules: Optional[dict] = None) -> str:
    """Map a raw category to a target category.

    Args:
        source: "alipay" or "wechat"
        raw_category: Original category from the source file
        description: Transaction description (used for keyword matching)
        amount: Transaction amount (used for amount-based rules)
        custom_rules: Optional user-defined overrides

    Returns:
        Target category string
    """
    # 1. Check custom rules first
    if custom_rules:
        key = f"{source}:{raw_category}"
        if key in custom_rules:
            return custom_rules[key]

    # 2. Get source-specific mapping
    source_map = CATEGORY_MAP.get(source, {})
    if raw_category in source_map:
        result = source_map[raw_category]
        # Handle special markers
        if result == "__skip__":
            return "__skip__"
        if result == "__income__":
            return "__income__"
        if result is None or result == "__keyword__":
            return _keyword_match(description, amount)
        return result

    # 3. Secondary keyword matching for "商户消费" and similar generic types
    return _keyword_match(description if description else raw_category, amount)


def _keyword_match(text: str, amount: float = 0.0) -> str:
    """Match text against keyword rules."""
    if not text:
        return "其他"

    text_lower = text.lower()

    for keywords, category in KEYWORD_RULES:
        for kw in keywords:
            if kw.lower() in text_lower:
                return category

    # Amount-based rule: large purchases may be 家庭支出
    if amount > 2000:
        household_kw = ["装修", "家具", "家电", "大件", "家居"]
        for kw in household_kw:
            if kw.lower() in text_lower:
                return "家庭支出（装修、大件）"

    return "其他"


def classify_income(description: str = "", counterparty: str = "",
                     channel: str = "") -> str:
    """Classify income into: 工资, 房租, 公司, 其他."""
    text = f"{description} {counterparty} {channel}".lower()
    if any(kw in text for kw in ["工资", "薪资", "薪酬", "代发", "salary"]):
        return "工资"
    if any(kw in text for kw in ["房租", "租金", "租房", "rent"]):
        return "房租"
    if any(kw in text for kw in ["公司", "企业", "glow", "收款", "company"]):
        return "公司"
    return "其他"


def get_all_categories() -> list[str]:
    return CATEGORIES
