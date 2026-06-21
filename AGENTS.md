# Family Accounting AI Agent Guide

## What this repository is
- Local family finance web app.
- Backend: `backend/` — Python + Flask API.
- Frontend: `frontend/` — React 18 + TypeScript + Vite + Ant Design.
- Data: `data/history/` stores parsed monthly JSON cache, `data/bills/` holds source Excel/CSV billing folders.

## Recommended commands
- Start backend:
  - `cd backend && python app.py`
- Start frontend:
  - `cd frontend && npm run dev`
- Windows launcher:
  - `.\start.ps1`

## Important files
- `backend/app.py` — Flask routes and API behavior.
- `backend/config.py` — category mapping, billing directory, allowed upload formats.
- `backend/services/classifier.py` — core expense classification logic.
- `backend/services/excel_reader.py` — parses Alipay CSV and WeChat XLSX.
- `backend/scripts/parse_month_folder.py` — batch parse of billing folders.
- `frontend/src/api/index.ts` — API client and request/response normalization.
- `frontend/src/pages/Import/` — import flow UI.
- `.claude/skills/import-month/SKILL.md` — existing import automation skill.

## Key conventions for AI agents
- Do not hardcode paths outside this repo; use `backend/config.py` values where possible.
- Billing month folders are under `data/bills/<month>` by default.
- `GET /api/data/expenses?month=` performs live classification using `backend/config.py` rules.
- `backend/config.py` controls classification rules and should be reloaded by restarting Flask after changes.

## Common tasks
- Import month data: use `.claude/skills/import-month/SKILL.md` and `backend/scripts/parse_month_folder.py`.
- Adjust categories: update `backend/config.py` and keep `KEYWORD_RULES` / `CATEGORY_MAP` aligned.
- Fix upload parsing: inspect `backend/services/excel_reader.py` and `backend/app.py` error handling.
- Frontend API/UI work: change `frontend/src/api/index.ts`, `frontend/src/store/`, then run Vite dev.

## Existing docs
- See `README.md` for project overview, startup steps, and API summary.
- See `CLAUDE.md` for the import-month workflow and classification system.

## Use this file for AI agent behavior
- Prefer `AGENTS.md` over duplicating docs from `README.md` or `CLAUDE.md`.
- Keep changes small and focused on repo-specific workflow, not generic Flask/React conventions.
