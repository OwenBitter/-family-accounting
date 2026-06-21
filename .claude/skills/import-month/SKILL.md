---
name: import-month
description: 从文件夹导入月度数据。解析 xlsx 提取支出/收入/资产，调用 Flask API 写入系统。当用户请求"导入X月数据"或提到"整理账单"时自动触发。
arguments:
  month: 月份或文件夹路径，如 "2026.5" 或 "/path/to/bills/2026.5"
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

## Purpose

当用户提供月份或文件夹路径时，自动完成以下流程：
1. 解析 xlsx 文件 → 提取支出/收入/资产数据
2. 调用 Flask API → 写入 data/history/ + Excel

## Steps

### Step 1: 确定文件夹路径

如果用户只给了月份（如 "2026.5"），文件夹路径为 `{bill_dir}/{month}`。
如果用户给了完整路径，直接使用。

### Step 2: 解析 xlsx

```bash
cd e:/tools/_dev/family-accounting
python backend/scripts/parse_month_folder.py "<folder>"
```

读取 `_manifest.json` 获取解析结果：
- `xlsx_data.expenses[person]` — 支出列表
- `xlsx_data.income[person]` — 收入列表
- `xlsx_data.assets[person]` — 资产快照

### Step 3: 调用 API 导入

确保 Flask 在运行（`:5000`），分两步导入：

**3a. 导入支出：**
对 manifest 中每个有数据的 person 调用：
```bash
curl -X POST http://localhost:5000/api/import/confirm \
  -H "Content-Type: application/json" \
  -d '{"person":"BB","month":"<month>","transactions":[...]}'
```

**3b. 导入资产/收入：**
使用 `PUT /api/data/assets` 和 `PUT /api/data/income` 更新资产和收入数据。

### Step 4: 验证

访问 http://localhost:5173 检查仪表盘数据是否正确。

## Constraints

- Flask 后端需提前启动（`cd backend && python app.py`）
- 前端 dev server：`cd frontend && npm run dev`

## Examples

用户说："导入 2026.5 的数据"
1. 文件夹 = `{bill_dir}/2026.5`
2. 运行 `parse_month_folder.py` 解析 xlsx
3. 调用 API 导入数据
4. 告知用户查看 http://localhost:5173

用户说："帮我整理 bills/currMonth"
1. 文件夹 = `{bill_dir}/currMonth`
2. 同上流程
