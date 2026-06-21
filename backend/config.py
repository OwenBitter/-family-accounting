import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
_data_dir = Path(os.getenv("DATA_DIR", BASE_DIR.parent / "data"))
DATA_DIR = _data_dir if _data_dir.is_absolute() else BASE_DIR.parent / _data_dir
HISTORY_DIR = DATA_DIR / "history"
TEMPLATES_DIR = DATA_DIR / "templates"
UPLOAD_DIR = BASE_DIR / "uploads"

TEMPLATE_FILE = TEMPLATES_DIR / "empty_book.xlsx"

_persons_raw = os.getenv("PERSONS", "BB,LN")
PERSONS = [p.strip() for p in _persons_raw.split(",") if p.strip()]
_labels_raw = os.getenv("PERSON_LABELS", '{"BB":"斌","LN":"纳"}')
try:
    PERSON_LABELS = json.loads(_labels_raw)
except (json.JSONDecodeError, TypeError):
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

# Transaction descriptions matching these keywords will be skipped (not treated as expense/income)
SKIP_KEYWORDS = [
    "小荷包-自动攒",
    "小荷包自动攒",
    "自动攒",
]

CATEGORY_MAP = {
    "alipay": {
        "日用百货": "购物（网购）",
        "家居家装": "购物（网购）",
        "服饰美容": "购物（网购）",
        "餐饮美食": "餐饮",
        "文化休闲": "__keyword__:娱乐",
        "交通出行": "交通",
        "保险": "医疗（保险、核酸等）",
        "运动户外": "购物（网购）",
        "数码家电": "购物（网购）",
        "数码电器": "购物（网购）",
        "充值缴费": "__keyword__:充值缴费",
        "生活服务": "__keyword__:生活服务",
        "医疗健康": "医疗（保险、核酸等）",
        "服饰装扮": "购物（网购）",
        "母婴亲子": "购物（网购）",
        "美容美发": "生活服务",
        "爱车养车": "交通",
        "教育": "其他",
        "住房物业": "充值缴费",
        "商业服务": "__keyword__:充值缴费",
        "投资理财": "__skip__",
        "转账红包": "__keyword__:转账（红包、人情）",
        "退款": "__income__",
        "其他": "__keyword__",
    },
    "wechat": {
        "微信红包（单发）": "转账（红包、人情）",
        "二维码收款": "__income__",
        "零钱提现": "__skip__",
        "转账": "转账（红包、人情）",
        "充值缴费": "充值缴费",
        "商户消费": "__keyword__:购物（网购）",
        "扫二维码付款": "__keyword__:转账（红包、人情）",
        "群收款": "__keyword__:转账（红包、人情）",
        "转账红包": "转账（红包、人情）",
    },
    "xlsx": {
        "餐饮": "餐饮",
        "购物": "购物（网购）",
        "网购": "购物（网购）",
        "网购-电器": "购物（网购）",
        "网购-美妆": "购物（网购）",
        "数码电器": "购物（网购）",
        "家居家装": "购物（网购）",
        "娱乐": "娱乐",
        "游戏": "娱乐",
        "阅读": "娱乐",
        "充值缴费": "充值缴费",
        "充值": "充值缴费",
        "缴费充值": "充值缴费",
        "通讯费": "充值缴费",
        "电费": "充值缴费",
        "水费": "充值缴费",
        "公共服务": "充值缴费",
        "交通": "交通",
        "生活服务": "生活服务",
        "美容美发": "生活服务",
        "保洁": "生活服务",
        "生活": "生活服务",
        "宠物": "生活服务",
        "转账": "转账（红包、人情）",
        "人情": "转账（红包、人情）",
        "红包": "转账（红包、人情）",
        "转账红包": "转账（红包、人情）",
        "捐款": "转账（红包、人情）",
        "医疗": "医疗（保险、核酸等）",
        "医疗健康": "医疗（保险、核酸等）",
        "保险": "医疗（保险、核酸等）",
        "还款": "还款（房贷 信用卡）",
        "还贷": "还款（房贷 信用卡）",
        "房贷": "还款（房贷 信用卡）",
        "贷款": "还款（房贷 信用卡）",
        "装修": "家庭支出（装修、大件）",
        "家庭支出": "家庭支出（装修、大件）",
        "家庭大件": "家庭支出（装修、大件）",
        "商户消费": "__keyword__:购物（网购）",
        "公司": "其他",
        "报销": "其他",
        "理财亏损": "其他",
        "学习": "其他",
        "其他": "__keyword__",
    },
}

KEYWORD_RULES = [
    (["餐饮", "美食", "餐厅", "饭", "菜", "食", "饮", "茶", "咖啡", "面包", "蛋糕", "牛奶", "奶", "易购",
      "春华", "全麦兔司", "兔司", "快团团", "🌻", "余弦"], "餐饮"),
    (["超市", "百货", "购物", "商品", "日用", "文具", "杂货", "便利"], "购物（网购）"),
    (["数码", "手机", "电脑", "小米", "华为", "苹果"], "购物（网购）"),
    (["服装", "服饰", "衣服", "鞋", "穿搭", "母婴", "宝宝", "婴儿", "婴幼儿",
      "纸尿裤", "玩具", "京东", "淘宝", "天猫", "秒杀", "驱蚊", "蚊香",
      "发货", "包裹", "订单", "旗舰店", "专营店",
      "沃尔玛", "山姆", "云鲸", "扫地", "内衣", "文胸", "胸", "防蚊",
      "手机壳", "钢化膜", "耳机", "音箱", "电炖", "辅食", "商店",
      "优时通", "戎蓉", "服饰", "服装",
      "照片", "冲印", "相册", "相框"], "购物（网购）"),
    (["交通", "地铁", "公交", "打车", "加油", "停车", "高铁", "滴滴", "高德",
      "单车", "哈啰", "停车费", "一码通"], "交通"),
    (["医疗", "医院", "医保", "药", "体检", "口腔", "牙齿", "牙科", "保险",
      "挂号", "漱口水", "爱康", "社区", "服务中心"], "医疗（保险、核酸等）"),
    (["缴费", "话费", "水电", "物业", "煤气", "燃气", "DeepSeek", "API",
      "天然气", "电力", "水务", "电信", "公交充值", "iCloud", "瓦力"], "充值缴费"),
    (["装修", "家具", "家电", "大件", "家居", "家政"], "家庭支出（装修、大件）"),
    (["理发", "美发", "美甲", "美容", "保洁", "家政", "快递", "运费", "洗衣", "洗护", "清洁",
      "顺丰", "速运"], "生活服务"),
    (["红包", "人情", "礼金", "转账", "群收款", "扫码", "二维码收款"], "转账（红包、人情）"),
    (["阅读", "游戏", "旅游", "酒店", "电影", "娱乐", "视频", "apple", "起点",
      "鹰角", "网易", "音乐"], "娱乐"),
]

CATEGORIES = [
    "购物（网购）", "餐饮", "还款（房贷 信用卡）", "娱乐",
    "生活服务", "转账（红包、人情）", "充值缴费", "交通",
    "医疗（保险、核酸等）", "其他", "家庭支出（装修、大件）",
]

MONTH_FORMAT = "%Y.%-m"

# Billing source directory (where xlsx files and screenshots are stored)
_bill_dir = Path(os.getenv("BILL_DIR", "data/bills"))
BILL_DIR = _bill_dir if _bill_dir.is_absolute() else DATA_DIR.parent / _bill_dir

# Investment files (relative to BILL_DIR or absolute paths)
INVESTMENT_FILE = BILL_DIR / "投资记账/投资记账.xlsx"
GOLD_FILE = BILL_DIR / "投资记账/黄金.xlsx"

MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", "16777216"))
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".png", ".jpg", ".jpeg"}
