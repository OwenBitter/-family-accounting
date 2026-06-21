from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional


@dataclass
class Transaction:
    person: str  # "BB" | "LN"
    source: str  # "alipay" | "wechat"
    time: datetime
    raw_category: str
    target_category: str
    amount: float
    payment_method: str
    description: str
    counterparty: str
    status: str
    order_id: str = ""
    detected_person: Optional[str] = None
    person_confidence: str = "confirmed"

    def to_dict(self):
        d = asdict(self)
        d["time"] = self.time.isoformat()
        return d

    @classmethod
    def from_dict(cls, d):
        d = dict(d)
        d["time"] = datetime.fromisoformat(d["time"])
        return cls(**d)


@dataclass
class IncomeRecord:
    person: str
    time: datetime
    category: str  # "工资" | "其他"
    amount: float
    channel: str  # "支付宝" | "微信" | "银行卡"
    account: str
    note: str

    def to_dict(self):
        d = asdict(self)
        d["time"] = self.time.isoformat()
        return d

    @classmethod
    def from_dict(cls, d):
        d = dict(d)
        d["time"] = datetime.fromisoformat(d["time"])
        return cls(**d)


@dataclass
class AssetSnapshot:
    person: str
    month: str
    alipay_fund: float = 0.0
    alipay_yuebao: float = 0.0
    alipay_balance: float = 0.0
    wechat_balance: float = 0.0
    wechat_licaitong: float = 0.0
    bank_accounts: dict = field(default_factory=dict)
    other: dict = field(default_factory=dict)
    loan_receivable: float = 0.0

    @property
    def total(self):
        EXCLUDE_KEYS = {"总额", "总计"}
        bank_sum = sum(v for k, v in self.bank_accounts.items() if k not in EXCLUDE_KEYS)
        return round(
            self.alipay_fund + self.alipay_yuebao + self.alipay_balance
            + self.wechat_balance + self.wechat_licaitong
            + bank_sum + sum(self.other.values()), 2
        )

    def to_dict(self):
        d = asdict(self)
        d["total"] = self.total
        return d

    @classmethod
    def from_dict(cls, d):
        # Remove property-only fields that aren't constructor params
        clean = {k: v for k, v in d.items() if k != "total"}
        return cls(**clean)


@dataclass
class MonthlyData:
    month: str  # "2026.1"
    income: dict = field(default_factory=lambda: {"BB": [], "LN": []})
    expenses: dict = field(default_factory=lambda: {"BB": [], "LN": []})
    analysis: dict = field(default_factory=lambda: {"BB": {}, "LN": {}})
    assets: dict = field(default_factory=lambda: {"BB": None, "LN": None})
    last_balance: dict = field(default_factory=lambda: {"BB": 0.0, "LN": 0.0})
    external_asset: float = 0.0  # 外借资产
    other_asset: float = 0.0     # 其他资产（公司/公积金等）

    def to_dict(self):
        return {
            "month": self.month,
            "income": {
                p: [r.to_dict() for r in recs]
                for p, recs in self.income.items()
            },
            "expenses": {
                p: [t.to_dict() for t in txns]
                for p, txns in self.expenses.items()
            },
            "analysis": self.analysis,
            "assets": {
                p: a.to_dict() if a else None
                for p, a in self.assets.items()
            },
            "last_balance": self.last_balance,
            "external_asset": self.external_asset,
            "other_asset": self.other_asset,
        }

    @classmethod
    def from_dict(cls, d):
        md = cls(month=d["month"])
        md.income = {
            p: [IncomeRecord.from_dict(r) for r in recs]
            for p, recs in d.get("income", {}).items()
        }
        md.expenses = {
            p: [Transaction.from_dict(t) for t in txns]
            for p, txns in d.get("expenses", {}).items()
        }
        md.analysis = d.get("analysis", {"BB": {}, "LN": {}})
        md.assets = {
            p: AssetSnapshot.from_dict(a) if a else None
            for p, a in d.get("assets", {}).items()
        }
        md.last_balance = d.get("last_balance", {"BB": 0.0, "LN": 0.0})
        md.external_asset = d.get("external_asset", 0.0)
        md.other_asset = d.get("other_asset", 0.0)
        return md
