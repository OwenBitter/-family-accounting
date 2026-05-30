# 家庭记账工具 — 优化计划

## 优先级总览

| 优先级 | 方向 | 预计耗时 |
|--------|------|---------|
| ★★★ P0 | 一键导入脚本（Hermes 集成） | 2h |
| ★★★ P0 | 前端由 Flask 托管（单命令启动） | 0.5h |
| ★★☆ P1 | 分类自学习 | 3h |
| ★★☆ P1 | 月度定时提醒（Hermes cron） | 0.5h |
| ★☆☆ P2 | 移动端 PWA 适配 | 4h |
| ★☆☆ P2 | 预算管理 | 5h |
| ★☆☆ P2 | 数据备份 | 1h |
| ☆☆☆ P3 | 环比/同比对比 | 2h |
| ☆☆☆ P3 | OCR 增强（百度 OCR） | 3h |

---

## P0: 一键导入脚本

### 目标

消除 CLI 三步操作（parse → OCR → API），改为一句话：

```bash
python3 backend/scripts/import_month.py 2026.5
# 或通过 Hermes: "导入5月账单"
```

### 现状

导入需要：
1. `parse_month_folder.py` 解析 xlsx
2. `ocr_analyze.py` OCR 截图（依赖 Tesseract + 环境变量）
3. 手动 curl API 写入（依赖 Flask 运行）

### 方案

新建 `backend/scripts/import_month.py`，整合三步：

```
import_month.py <月份>

1. 自动检测 Flask 是否运行，未运行则直接操作 data_store + excel_writer
2. 解析 bills/<month>/{ln,xzb}/ 下的 CSV + xlsx
3. 运行 OCR 分析截图
4. 合并所有数据、自动分类
5. 写入 JSON 缓存 + 生成 Excel
6. 输出导入摘要
```

### 关键改动

| 文件 | 说明 |
|------|------|
| 新建 `backend/scripts/import_month.py` | 一键导入入口 |
| 改 `backend/services/data_store.py` | 支持直接操作（不依赖 Flask） |
| 改 `backend/config.py` | 确认 BILL_DIR 配置 |

### 参数

```
python3 import_month.py <月份> [--skip-ocr] [--person BB|LN|all]
```

- `--skip-ocr`: 跳过截图识别（纯支出导入）
- `--person`: 只导入单人
- 无参数时交互式选择月份

### 验证

```bash
cd /mnt/e/tools/family-accounting
python3 backend/scripts/import_month.py 2026.5
# 输出: 导入 BB 支出 15 笔, LN 支出 18 笔, 资产 BB ¥209903, LN ¥967356
# 生成 data/history/家庭收支2026.5.xlsx
```

---

## P0: 前端由 Flask 托管

### 目标

`cd backend && python3 app.py` 一个命令即启动完整应用，无需另开终端跑 `npm run dev`。

### 方案

Flask 添加静态文件路由，serve `frontend/dist/` 构建产物。

`backend/app.py` 加：

```python
from flask import send_from_directory

FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"

@app.route("/")
@app.route("/<path:path>")
def serve_frontend(path="index.html"):
    if (FRONTEND_DIST / path).exists():
        return send_from_directory(str(FRONTEND_DIST), path)
    return send_from_directory(str(FRONTEND_DIST), "index.html")
```

### 目录结构调整

构建前端后产物自动在 `frontend/dist/`，Flask 直接读取。

可选：加启动脚本 `start.sh`，先检查 dist 是否存在，不存在则提示先 `npm run build`。

### 验证

```bash
cd backend && python3 app.py
# 浏览器打开 http://localhost:5000 即看到完整前端
```

---

## P1: 分类自学习

### 目标

用户手动修正分类后，系统记住规则，下次同描述自动匹配。

### 方案

**学习数据存储**: `data/learned_rules.json`

```json
{
  "rules": [
    {
      "description_pattern": "蜜雪冰城",
      "amount_range": [0, 100],
      "source": "wechat",
      "target_category": "餐饮",
      "count": 3,
      "last_applied": "2026-05"
    }
  ]
}
```

**匹配优先级**（从高到低）：
1. learned_rules 精确匹配（描述关键词 + 来源）
2. CATEGORY_MAP 映射（来源分类）
3. KEYWORD_RULES 模糊匹配
4. 默认 → "其他"

**前端交互**：
- 导入预览表格的"分类"列改为可编辑 Select
- 用户修改后，行标记为"已修正"
- 确认导入时，修正记录随 transactions 一起提交
- 后端 `classifier.learn()` 写入 learned_rules.json

**去重/冲突**：
- 同一条规则命中 3 次以上才算稳定规则
- 用户可查看/删除已学规则（Web 设置页）

### 关键文件

| 文件 | 改动 |
|------|------|
| `backend/services/classifier.py` | 加 `learn()` 和 `load_learned_rules()` |
| `backend/app.py` POST /api/import/confirm | 接收 corrected_categories |
| `frontend/src/pages/Import/` | 分类列改 Select，提交时传修正数据 |

---

## P1: 月度定时提醒（Hermes cron）

### 目标

每月 1 号 Hermes 自动检查 `data/bills/currMonth/` 是否有新文件，有则提醒用户导入。

### 方案

```bash
hermes cron create --name "记账月度提醒" \
  --schedule "0 9 1 * *" \
  --prompt "检查 /mnt/e/tools/family-accounting/data/bills/currMonth/ 目录是否有新文件（支付宝CSV/微信xlsx/截图）。如果有，提醒用户导入；如果没有，检查上月是否已导入，未导入则提醒补录。"
```

触发时 Hermes 给用户发消息：
> 📊 新月份到了！currMonth 目录发现 2 个待导入文件（BB 支付宝账单 + LN 微信账单），要现在导入吗？

---

## P2: 移动端 PWA 适配

### 目标

手机拍照后直接打开网页上传，无需转存到电脑。

### 方案

- `vite-plugin-pwa` 添加 Service Worker + manifest.json
- 上传区域支持相机拍照（`<input capture="environment">`）
- 响应式布局：移动端单列、表格横向滚动
- 图片上传前自动压缩（前端用 Canvas resize）

### 关键文件

| 文件 | 改动 |
|------|------|
| `frontend/vite.config.ts` | 加 vite-plugin-pwa |
| `frontend/public/manifest.json` | 新建 PWA manifest |
| `frontend/src/pages/Import/` | 响应式 + 相机拍照 |

---

## P2: 预算管理

### 目标

设置月度预算，超支告警，分类进度可视化。

### 方案

**预算配置** (`data/budgets.json`):
```json
{
  "by_month": { "total": 20000 },
  "by_category": { "餐饮": 5000, "购物（网购）": 3000 },
  "by_person": { "BB": 10000, "LN": 10000 }
}
```

**前端**:
- Dashboard 加"预算进度"卡片（环形进度条）
- 超支分类红色高亮
- 设置页面编辑预算

**后端 API**:
- `GET /api/budget?month=` — 返回预算 vs 实际
- `PUT /api/budget` — 更新预算配置

---

## P2: 数据备份

### 目标

防止数据丢失。

### 方案（选一）

**方案 A — Git 自动提交**:
```bash
# Hermes cron 每月2号凌晨
cd /mnt/e/tools/family-accounting
git add data/history/ && git commit -m "auto: $(date +%Y.%m)" && git push
```

**方案 B — 复制到云盘**:
```bash
cp data/history/家庭收支*.xlsx /mnt/e/账单/
```

建议 A，因为 Git 有版本历史，误操作可回滚。

---

## P3: 环比/同比对比

### 目标

Dashboard 趋势图加环比（vs上月）和同比（vs去年同月）。

### 方案

趋势图 tooltip 中显示：
- 收入 ¥18,470（环比 +12% ↑，同比 +5% ↑）
- 支出 ¥19,254（环比 -3% ↓，同比 +8% ↑）

后端 `/api/data/trend` 返回数据中附加 `mom_change` / `yoy_change` 字段。

---

## P3: OCR 增强（百度 OCR）

### 目标

EasyOCR 对复杂截图准确率不够时，可选在线 OCR 兜底。

### 方案

`ocr_service.py` 加策略模式：

```python
# 1. 优先 EasyOCR（离线、免费）
# 2. 如果 confidence < 0.6，且配置了 API key → 调百度 OCR
# 3. 后端 settings 页面可配置 API key
```

百度 OCR 免费额度：1000次/月，足够家庭用。准确率对数字识别极高。

---

## 实施建议

**第一轮**（P0，半天）：
1. Flask 托管前端
2. 一键导入脚本
3. 同步更新 Hermes skill

**第二轮**（P1，半天）：
4. 分类自学习
5. 月度定时提醒

**第三轮**（P2-P3，按需）：
6. 移动端 PWA
7. 预算管理
8. 数据备份

---

## 补充方向（未在原计划中）

### OCR 文档更新
OPTIMIZE.md 中 OCR 部分仍引用 EasyOCR，实际已切换到 **Tesseract + chi_sim**。需同步更新文档描述。

### 前端页面完善
| 页面 | 文件存在 | 路由接入 | 状态 |
|------|---------|---------|------|
| 支出分析 `/analysis` | ✅ | ✅ | 功能待完善 |
| 导出 `/export` | ✅ | ❌ | 未接入路由 |
| 收入管理 `/income` | ✅ | ❌ | 未接入路由 |
| 分类管理 | ❌ | ❌ | 未实现 |

### 投资模块进阶
- 黄金持仓盈亏计算（买入价 vs 当前价）
- 金价历史走势图
- 外借还款计划与提醒
- 资产负债汇总表

### 测试覆盖
- 后端：pytest 核心逻辑（classifier、excel_reader、data_store）
- OCR：截图识别准确率测试集
- 前端：vitest 组件测试

### 代码质量
- Python 类型注解补齐
- TypeScript strict 模式
- ESLint 规则启用
- API 文档（OpenAPI/Swagger）

### DevOps
- Docker Compose 一键启动
- pre-commit hook（格式化 + lint）

### Claude Code Skill 扩展
- `/compare-months` — 月份对比
- `/check-budget` — 预算检查
- `/monthly-report` — 生成月度摘要
