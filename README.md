# 家庭记账工具

本地家庭财务 Web 应用，支持支付宝/微信支出导入、ECharts 可视化仪表盘、Excel 标准化输出。

## 快速开始

### 启动后端

```bash
cd backend
python app.py
# → http://localhost:5000
```

### 启动前端

```bash
cd frontend
npm run dev
# → http://localhost:5173
```

## 项目结构

```
E:\tools\family-accounting\
├── backend/
│   ├── app.py                  # Flask 入口 + API 路由
│   ├── config.py               # 配置（分类映射、人员配置）
│   ├── models/schemas.py       # 数据模型（Transaction, AssetSnapshot...）
│   ├── services/
│   │   ├── data_store.py       # JSON 文件缓存
│   │   ├── excel_reader.py     # 解析支付宝 CSV + 微信 xlsx
│   │   ├── excel_writer.py     # 生成标准记账 xlsx
│   │   ├── classifier.py       # 支出/收入分类引擎
│   ├── scripts/
│   │   ├── migrate_history.py  # 历史数据迁移（xlsx → JSON 缓存）
│   │   └── parse_month_folder.py # 解析月份文件夹（xlsx）
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # 路由配置
│   │   ├── pages/
│   │   │   ├── Dashboard/      # 总览仪表盘
│   │   │   ├── Import/         # 导入支出
│   │   │   └── Investment/     # 投资（黄金/外借资产）
│   │   ├── components/         # 通用组件
│   │   ├── api/index.ts        # API 调用层（camelCase/snake_case 转换）
│   │   ├── store/              # Zustand 状态管理
│   │   └── types/index.ts      # TypeScript 类型定义
│   └── package.json
├── data/history/                # JSON 缓存 + Excel 输出
└── <bill_dir>/                   # 源数据目录（xlsx，由 config.py 配置）
    ├── 2022/ ~ 2026/            # 历史月份文件夹
    └── currMonth/                # 当月待处理数据
```

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3.11 + Flask |
| 前端 | React 18 + TypeScript + Vite 5 |
| UI | Ant Design 5 + ECharts 5 |
| 状态管理 | Zustand (localStorage 持久化) |
| 数据存储 | JSON 文件缓存 + Excel (openpyxl) |

## 导入数据

### 方式一：Web 页面上传

在浏览器中打开 http://localhost:5173 ，进入"导入数据"页面：
1. **导入支出**：上传支付宝 CSV / 微信 xlsx，自动分类，预览后确认

### 方式二：Claude Code 文件夹导入

1. 将 xlsx 整理到 `{bill_dir}/<月份>/` 目录
2. 在 Claude Code 中执行：`/import-month <月份>`
3. 自动完成：
   - 解析 xlsx 提取支出/收入
   - 调用 API 写入系统

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/import/preview` | 上传文件，预览解析结果 |
| POST | `/api/import/confirm` | 确认导入支出 |
| PUT | `/api/data/assets` | 更新资产数据 |
| GET | `/api/data/summary?month=` | 月汇总数据 |
| GET | `/api/data/expenses?month=` | 支出明细+分类分析 |
| GET | `/api/data/assets?month=` | 资产快照 |
| GET | `/api/data/trend` | 全部月份趋势 |
| GET | `/api/export?month=` | 下载 Excel |

## 分类映射

系统将支付宝/微信的原始分类映射到 11 个标准分类：
`购物（网购）`、`餐饮`、`还款（房贷 信用卡）`、`娱乐`、`生活服务`、`转账（红包、人情）`、`充值缴费`、`交通`、`医疗（保险、核酸等）`、`其他`、`家庭支出（装修、大件）`

映射规则见 `backend/config.py` 和 `backend/services/classifier.py`。
