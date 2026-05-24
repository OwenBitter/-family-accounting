import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "data"
HISTORY_DIR = DATA_DIR / "history"
TEMPLATES_DIR = DATA_DIR / "templates"
UPLOAD_DIR = BASE_DIR / "uploads"

TEMPLATE_FILE = TEMPLATES_DIR / "empty_book.xlsx"

PERSONS = ["BB", "LN"]
PERSON_LABELS = {"BB": "斌", "LN": "纳"}

# Person auto-detection keywords.
# Replace with actual account identifiers to enable auto-detection.
ALIPAY_ACCOUNTS = {
    "BB": {"keywords": []},
    "LN": {"keywords": []},
}

WECHAT_NICKNAMES = {
    "BB": {"keywords": []},
    "LN": {"keywords": []},
}

CATEGORY_MAP = {
    "alipay": {
        "日用百货": "购物（网购）",
        "家居家装": "购物（网购）",
        "服饰美容": "购物（网购）",
        "餐饮美食": "餐饮",
        "文化休闲": "娱乐",
        "交通出行": "交通",
        "保险": "医疗（保险、核酸等）",
        "运动户外": "娱乐",
        "数码家电": "购物（网购）",
        "充值缴费": "充值缴费",
        "生活服务": "生活服务",
        "教育": "其他",
        "其他": "其他",
    },
    "wechat": {
        "微信红包（单发）": "转账（红包、人情）",
        "二维码收款": "__income__",
        "零钱提现": "__skip__",
        "转账": "转账（红包、人情）",
        "充值缴费": "充值缴费",
    },
}

KEYWORD_RULES = [
    (["餐饮", "美食", "餐厅", "饭", "菜", "食", "饮", "茶", "咖啡"], "餐饮"),
    (["超市", "百货", "购物", "商品", "日用"], "购物（网购）"),
    (["交通", "地铁", "公交", "打车", "加油", "停车", "高铁"], "交通"),
    (["医疗", "医院", "医保", "药", "体检"], "医疗（保险、核酸等）"),
    (["缴费", "话费", "水电", "物业", "煤气"], "充值缴费"),
    (["装修", "家具", "家电", "大件"], "家庭支出（装修、大件）"),
    (["理发", "美发", "美甲", "美容", "保洁", "快递", "洗衣"], "生活服务"),
    (["红包", "人情", "礼金"], "转账（红包、人情）"),
    (["阅读", "游戏", "旅游", "酒店", "电影", "娱乐"], "娱乐"),
]

CATEGORIES = [
    "购物（网购）", "餐饮", "还款（房贷 信用卡）", "娱乐",
    "生活服务", "转账（红包、人情）", "充值缴费", "交通",
    "医疗（保险、核酸等）", "其他", "家庭支出（装修、大件）",
]

MONTH_FORMAT = "%Y.%-m"

# Billing source directory (where xlsx files and screenshots are stored)
# Set to your actual billing directory path
BILL_DIR = DATA_DIR / "bills"

# Investment files (relative to BILL_DIR or absolute paths)
INVESTMENT_FILE = BILL_DIR / "投资记账/投资记账.xlsx"
GOLD_FILE = BILL_DIR / "投资记账/黄金.xlsx"

MAX_CONTENT_LENGTH = 16 * 1024 * 1024
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".png", ".jpg", ".jpeg"}
