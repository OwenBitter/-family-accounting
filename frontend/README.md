# 前端 - 家庭记账工具

React 18 + TypeScript + Vite 5 + Ant Design 5 + ECharts 5 + Zustand

## 开发

```bash
npm run dev     # 启动开发服务器 → http://localhost:5173
npm run build   # 生产构建
npm run preview # 预览构建结果
```

## 路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | Dashboard | 总览仪表盘：统计卡片、趋势图、分类分析、资产构成 |
| `/import` | Import | 导入支出（xlsx/CSV） + 手动记账 |
| `/investment` | Investment | 黄金资产 + 外借资产明细 |

## 项目结构

```
src/
├── main.tsx              # 入口
├── App.tsx               # HashRouter 路由
├── AppLayout.tsx         # 侧边栏布局
├── pages/
│   ├── Dashboard/        # 仪表盘（统计卡片、ECharts 图表）
│   ├── Import/           # 导入页（文件上传 + 手动记账）
│   └── Investment/       # 投资页（黄金/外借表格）
├── components/           # 通用组件
├── api/index.ts          # axios 封装（camelCase/snake_case 拦截器）
├── store/useAppStore.ts  # Zustand 全局状态（localStorage 持久化）
├── types/index.ts        # TS 类型定义
└── styles/global.less    # 全局样式（暗色主题）
```

## 关键依赖

| 包 | 用途 |
|----|------|
| antd | UI 组件库 |
| echarts + echarts-for-react | 图表（暗色主题） |
| zustand | 状态管理（persist 中间件持久化） |
| axios | HTTP 请求（拦截器自动转换 snake_case ↔ camelCase） |
| react-router-dom | HashRouter 路由 |
| less | CSS 预处理 |

## API 约定

- 请求体自动 `camelCase → snake_case`
- 响应体自动 `snake_case → camelCase`
- 错误统一通过 `message.error()` 提示
- 文件上传用 `FormData`，跳过 JSON 转换
