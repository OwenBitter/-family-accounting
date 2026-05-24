# Family Accounting Project Guide

## Skill
- **`/import-month`** — 从文件夹导入月度数据（xlsx 解析 + OCR 截图）
  - 调用：`/import-month <month>`，如 `/import-month 2026.5`
  - 定义：`.claude/skills/import-month/SKILL.md`
  - 流程：解析 xlsx → OCR 截图 → 调用 API

## Quick Start
```bash
cd backend && python app.py          # Flask API → :5000
cd frontend && npm run dev            # Vite dev → :5173
```

## Import Month Workflow
Skill `/import-month` 自动执行以下步骤。也可手动操作：

### Step 1: Parse xlsx
```bash
python backend/scripts/parse_month_folder.py "<bill_dir>/<month>" --stdout
```
Extracts expenses/income/assets from xlsx files.

### Step 2: OCR screenshots
```bash
TESSDATA_PREFIX=~/tessdata python backend/scripts/ocr_analyze.py "<bill_dir>/<month>" --json
```
Uses Tesseract + Chinese lang pack to extract balances from images.

### Step 3: Import via API
- Expenses: `POST /api/import/confirm` with person+month+transactions
- Assets/income: `POST /api/ocr/confirm` with person+month+data

## OCR Tooling
- **Tesseract** at `C:\Program Files\Tesseract-OCR\tesseract.exe`
- **Chinese lang** at `~/tessdata/chi_sim.traineddata`
- **Env**: `TESSDATA_PREFIX=~/tessdata` must be set
- Script: `backend/scripts/ocr_analyze.py` for batch analysis

## Key Scripts
| Script | Purpose |
|--------|---------|
| `scripts/migrate_history.py` | One-time: migrate all xlsx to JSON cache |
| `scripts/parse_month_folder.py` | Parse month folder → xlsx manifest |
| `scripts/ocr_analyze.py` | OCR screenshots → structured data |
| `scripts/generate_template.py` | Generate empty xlsx template |

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/import/preview | Upload & preview expense files |
| POST | /api/import/confirm | Confirm expense import |
| POST | /api/ocr/confirm | Save asset/income data |
| GET | /api/data/summary?month= | Monthly summary |
| GET | /api/data/expenses?month= | Expense details + analysis |
| GET | /api/data/assets?month= | Asset snapshots |
| GET | /api/data/trend | All months trend data |
| GET | /api/export?month= | Download xlsx |

## Data Flow
```
<bill_dir>/<month>/  →  parse_month_folder.py  →  JSON manifest
                     →  ocr_analyze.py          →  asset/income data
                     →  Flask API               →  data/history/*.json + xlsx
```
