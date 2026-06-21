# Family Accounting Project Guide

## Skills
- **`/import-month`** — 从文件夹导入月度数据（xlsx 解析）
  - 调用：`/import-month <month>`，如 `/import-month 2026.5`
  - 定义：`.claude/skills/import-month/SKILL.md`
  - 流程：解析 xlsx → 调用 API

## Quick Start
```bash
cd e:/tools/_dev/family-accounting/backend && python app.py   # Flask API → :5000
cd e:/tools/_dev/family-accounting/frontend && npm run dev     # Vite dev → :5174
```

## Import Month Workflow
Skill `/import-month` 自动执行以下步骤。也可手动操作：

### Step 1: Parse xlsx
```bash
python backend/scripts/parse_month_folder.py "<bill_dir>/<month>" --stdout
```
Extracts expenses/income/assets from xlsx files.

### Step 2: Import via API
- Expenses: `POST /api/import/confirm` with person+month+transactions
- Assets/income: `PUT /api/data/assets` with person+month+data

## Classification System
支出分类在 `backend/config.py` 中配置，支持两种方式：

### 1. 原始分类映射（CATEGORY_MAP）
按支付来源（alipay/wechat）+ 原始分类直接映射到目标分类。优先级最高。
```python
CATEGORY_MAP = {
    "alipay": {
        "日用百货": "购物（网购）",
        "医疗健康": "医疗（保险、核酸等）",
        "数码电器": "购物（网购）",
        ...
    },
    "wechat": {
        "商户消费": "__keyword__",  # 使用描述关键词匹配
        "扫二维码付款": "转账（红包、人情）",
        ...
    },
}
```

### 2. 描述关键词匹配（KEYWORD_RULES）
当原始分类未命中或标记为 `__keyword__` 时，按交易描述中的关键词匹配。
```python
(["服装", "服饰", "衣服"], "购物（网购）"),
(["医疗", "医院", "口腔", "保险"], "医疗（保险、核酸等）"),
(["红包", "转账", "群收款", "扫码"], "转账（红包、人情）"),
...
```

### 标准分类列表
`购物（网购）`, `餐饮`, `还款（房贷 信用卡）`, `娱乐`, `生活服务`,
`转账（红包、人情）`, `充值缴费`, `交通`, `医疗（保险、核酸等）`,
`其他`, `家庭支出（装修、大件）`

> **注意**: `GET /api/data/expenses` 的 `analysis` 字段是实时分类的（不受已存储的 target_category 限制），修改 `config.py` 后重启 Flask 即可生效。

## Key Scripts
| Script | Purpose |
|--------|---------|
| `scripts/migrate_history.py` | One-time: migrate all xlsx to JSON cache |
| `scripts/parse_month_folder.py` | Parse month folder → xlsx manifest |
| `scripts/generate_template.py` | Generate empty xlsx template |

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/import/preview | Upload & preview expense files |
| POST | /api/import/confirm | Confirm expense import (stores target_category) |
| PUT | /api/data/assets | Update asset data |
| GET | /api/data/summary?month= | Monthly summary |
| GET | /api/data/expenses?month= | Expense details + **live-classified** analysis |
| GET | /api/data/assets?month= | Asset snapshots |
| GET | /api/data/trend | All months trend data |
| GET | /api/export?month= | Download xlsx |

## Data Flow
```
<bill_dir>/<month>/  →  parse_month_folder.py  →  JSON manifest
                     →  Flask API               →  data/history/*.json + xlsx
                     →  GET /api/data/expenses  →  live classify via config.py
```
