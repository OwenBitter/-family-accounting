# 家庭记账工具 — 实施计划（已归档）

> 本文档是项目初期的实施计划，功能已基本完成。最新文档请查看 [README.md](README.md)。

## 目标

在 `E:\tools\family-accounting\` 新建一个本地家庭记账 Web 应用，支持：
1. 导入支付宝/微信每月支出明细（CSV/xlsx），自动分类并合并两人数据
2. 拍照识别支付宝/微信/银行卡的当月收入、余额截图（OCR）
3. 可视化报表（ECharts）：月度收支趋势、分类占比、两人对比
4. 生成标准化 Excel 记账文件（兼容现有 `家庭收支2026.1.xlsx` 格式）

## 项目当前状态

- 项目骨架：完全空白，无后端/前端代码
- 已有参考数据：`E:\账单\` 下有 2026.1 月的完整数据（LN + XZB 的支付宝 CSV 和微信 xlsx）
- 已有模板：`家庭收支2026.1.xlsx`（5 个 Sheet，含公式）
- Python 环境：Python 3.11.5 已安装，openpyxl/Flask 等已可用

---

## 现有模板分析（关键参考）

### Excel 模板 `家庭收支2026.1.xlsx` 结构

#### Sheet 1: 总（月汇总）
| 单元格 | 内容 | 公式 |
|--------|------|------|
| D2 | 月份（如"1月"） | — |
| B4 | BB | — |
| C4 | 上月余额 | — |
| D4 | 收入 | =SUM(收入!D2:D2) |
| E4 | 支出 | =支出分析!D14 |
| F4 | 本月攒 | =D4-E4 |
| G4 | 已有总额 | =理财!N9 |
| B5 | LN | — |
| C5 | 上月余额 | — |
| D5 | 收入 | =SUM(收入!D3:D4) |
| E5 | 支出 | =支出分析!C14 |
| F5 | 本月攒 | =D5-E5 |
| G5 | 已有总额 | =理财!O4 |
| B6 | 总额 | =C4+C5 / =D4+D5 / =E4+E5 / =F5+F4 / =G4+G5 |
| H6 | - | =G6-C6 |
| B7 | 外借资产 | — |
| G7 | 外借资产值 | — |
| B8 | 家庭资产 | =G6+G7 |

> 注意：收入 sheet 中 D2=BB收入, D3:D4=LN收入（可能有多笔）
> 支出分析!C14=LN总支出, 支出分析!D14=BB总支出

#### Sheet 2: 收入（收入明细）
列：入账时间 | 账务类型 | 收入(+元) | 支付渠道 | 对方账户 | 备注
A 列标注人员（"斌"/"纳"）

#### Sheet 3: 支出明细（支出流水）
列：[A]人员（合并单元格标注"斌"/"纳"）| [B]出账时间 | [C]账务类型 | [D]支出(-元) | [E]支付渠道 | [F]备注

#### Sheet 4: 支出分析（分类汇总）
| 行 | B列(分类) | C列(LN支出) | D列(BB支出) | E列(总支出) |
|----|-----------|-------------|-------------|-------------|
| 3-13 | 11个分类 | LN金额 | BB金额 | SUM |
| 14 | 总计 | =SUM(C3:C13) | =SUM(D3:D13) | =SUM(E3:E13) |

11 个支出分类：
1. 购物（网购）
2. 餐饮
3. 还款（房贷 信用卡）
4. 娱乐（阅读、游戏、旅游等消遣活动）
5. 生活服务（美容、美发、美甲、保洁、快递等）
6. 转账（红包、人情）
7. 充值缴费（通讯费 水费 物业费等）
8. 交通
9. 医疗（保险、核酸等）
10. 其他
11. 家庭支出（装修、大件）

#### Sheet 5: 理财（资产负债）
| 区域 | 内容 |
|------|------|
| BB 区(B4:O4) | 支付宝(基金/余额宝/余额) + 微信(零钱/零钱通) + 各银行卡 + 小可爱 + 养老保险 + 总额公式 |
| LN 区(B9:N9) | 同上结构（银行卡不同），含总额公式 |
| 外借资产(B15:F15) | 当前外借、7月归还、总金额公式 |

### 源文件格式

#### 支付宝 CSV
- 编码：GBK
- 前 24 行：元数据（账户、时间范围、汇总统计、说明）
- 第 24 行（0-indexed）：列头
- 第 25 行+：交易数据
- 列：交易时间 | 交易分类 | 交易对方 | 对方账号 | 商品说明 | 收/支 | 金额 | 收/付款方式 | 交易状态 | 交易订单号 | 商家订单号 | 备注

#### 微信 xlsx
- 前 16 行：元数据（昵称、时间范围、汇总统计、说明）
- 第 17 行（0-indexed）：列头
- 第 18 行+：交易数据
- 列：交易时间 | 交易类型 | 交易对方 | 商品 | 收/支 | 金额(元) | 支付方式 | 当前状态 | 交易单号 | 商户单号 | 备注

---

## 数据模型

### 标准化交易记录（Python dataclass）

```python
@dataclass
class Transaction:
    person: str            # "BB" | "LN"
    source: str            # "alipay" | "wechat"
    time: datetime         # 交易时间
    raw_category: str      # 原始分类（如"餐饮美食"）
    target_category: str   # 映射后分类
    amount: float          # 金额（支出为负，收入为正）
    payment_method: str    # 支付方式
    description: str       # 商品说明/备注
    counterparty: str      # 交易对方
    status: str            # 交易状态
    order_id: str          # 交易订单号（用于重复检测）
    detected_person: str | None   # auto_detect 结果（"BB"/"LN"/None）
    person_confidence: str        # "confirmed" | "auto_detected" | "mismatch"
```

### 标准化收入记录

```python
@dataclass
class IncomeRecord:
    person: str
    time: datetime
    category: str          # "工资"/"其他"
    amount: float
    channel: str           # "支付宝"/"微信"/"银行卡"
    account: str           # 对方账户
    note: str
```

### 资产余额快照

```python
@dataclass
class AssetSnapshot:
    person: str
    month: str             # "2026.1"
    alipay_fund: float     # 基金
    alipay_yuebao: float   # 余额宝
    alipay_balance: float  # 余额
    wechat_balance: float  # 零钱
    wechat_licaitong: float # 零钱通
    bank_accounts: dict    # {"bank_name": amount, ...}
    other: dict            # {"小可爱": amount, "养老保险": amount, ...}
    loan_receivable: float # 外借资产
```

### TypeScript 类型定义（前端）

```typescript
interface Transaction {
  person: 'BB' | 'LN';
  source: 'alipay' | 'wechat';
  time: string;         // ISO datetime
  rawCategory: string;
  targetCategory: string;
  amount: number;
  paymentMethod: string;
  description: string;
  counterparty: string;
  status: string;
}

interface MonthlySummary {
  month: string;
  bb: { lastBalance: number; income: number; expense: number; saved: number; total: number };
  ln: { lastBalance: number; income: number; expense: number; saved: number; total: number };
  total: { income: number; expense: number; saved: number; grandTotal: number };
  externalAsset: number;
  familyAsset: number;
}

interface CategoryAnalysis {
  category: string;
  bbAmount: number;
  lnAmount: number;
  totalAmount: number;
}

interface AssetData {
  person: 'BB' | 'LN';
  alipayFund: number;
  alipayYuebao: number;
  alipayBalance: number;
  wechatBalance: number;
  wechatLicaitong: number;
  bankAccounts: Record<string, number>;
  total: number;
}
```

---

## API 设计

| 方法 | 路径 | 请求 | 响应 |
|------|------|------|------|
| GET | /api/health | — | `{status: "ok"}` |
| POST | /api/import/preview | `{person, month, files[], auto_detect: true}` | `{transactions[], statistics, person_warnings[]}` |
| POST | /api/import/confirm | `{person, month, transactions[]}` | `{success, filePath}` |
| POST | /api/ocr/upload | `{images[], person}` | `{results[{image, channel, amounts, confidence, detected_person}]}` |
| POST | /api/ocr/confirm | `{month, person, data: AssetSnapshot}` | `{success}` |
| GET | /api/data/summary?month=2026.1 | — | `MonthlySummary` |
| GET | /api/data/expenses?month=2026.1 | — | `{details[], analysis[]}` |
| GET | /api/data/assets?month=2026.1 | — | `AssetData[]` |
| GET | /api/data/income?month=2026.1 | — | `{records[]}` |
| GET | /api/categories | — | `{mappings[]}` |
| PUT | /api/categories/mapping | `{mappings[]}` | `{success}` |
| GET | /api/data/history | — | `{availableMonths[]}` |
| GET | /api/export?month=2026.1 | — | 下载 xlsx 文件 |

## 技术方案补充

### 前端工程配置

**Vite proxy（连接 Flask 后端）**
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
```

**Flask-CORS 配置**
```python
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173", "http://localhost:3000"]}})
```

### 前端依赖版本锁定

| 包 | 版本 | 用途 |
|---|------|------|
| react | ^18.3 | UI 框架 |
| react-dom | ^18.3 | DOM 渲染 |
| react-router-dom | ^6.26 | 路由 |
| antd | ^5.20 | UI 组件库 |
| @ant-design/icons | ^5.4 | 图标 |
| echarts | ^5.5 | 图表 |
| echarts-for-react | ^3.0 | React ECharts 封装 |
| zustand | ^4.5 | 状态管理 |
| axios | ^1.7 | HTTP 请求 |
| less | ^4.2 | CSS 预处理 |
| dayjs | ^1.11 | 日期处理 |

### 数据缓存层设计

为避免每次请求都解析 xlsx，后端增加 JSON 缓存：

```python
# backend/services/data_store.py
class DataStore:
    """
    以 JSON 文件缓存各月解析结果，结构：
    data/history/
    ├── 2026.1.json       # 月度完整数据缓存
    ├── 2026.2.json
    └── index.json         # 所有可用月份索引
    """
    def get_month(month: str) -> MonthlyData
    def save_month(month: str, data: MonthlyData)
    def get_history() -> List[str]
    def rebuild_from_excel(path: str) -> MonthlyData
```

缓存内容（`MonthlyData`）：每月一条完整数据，包含收入、支出明细、分类分析、资产快照。

**启动时流程**：后端启动时扫描 `data/history/`，读取 index.json；若不存在缓存，从 xlsx 文件重建。

### 历史数据迁移

首次使用前，运行一次性迁移脚本：

```bash
python backend/scripts/migrate_history.py
```

功能：
1. 扫描 `E:\账单\` 下所有 `家庭收支XXXX.X.xlsx` 文件
2. 用 `excel_reader.read_existing_book()` 解析已有数据
3. 存入 `data/history/` JSON 缓存
4. 生成 `data/history/index.json`

### 文件处理与输出策略

| 场景 | 行为 |
|------|------|
| 导入确认 | xlsx 输出到 `data/history/` 目录，文件名 `家庭收支{month}.xlsx` |
| 已有同月文件 | 覆盖更新（先读出现有数据→追加新数据→写入） |
| 导出请求 | 从 `data/history/` 读取对应文件返回下载 |
| 不覆盖源文件 | 永不修改 `E:\账单\` 下的原始文件 |

### OCR 金额识别技术方案

#### OCR 引擎选择

| 引擎 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **PaddleOCR** | 中文识别率最高，有专门的金额数字优化模型 | 安装包大（~100MB），CPU 版推理较慢 | 首选 |
| **EasyOCR** | 轻量易安装，支持中文 | 复杂背景识别率低于 PaddleOCR | 备选（PaddleOCR 安装困难时回退） |

最终策略：**用 EasyOCR 起步**，如果识别率不够再换 PaddleOCR。因为场景是有限字段（余额、零钱等几个数字），EasyOCR 够用。

#### 完整处理流水线

```
截图上传
  ↓
Step 1 - 截图类型分类（自动判断是哪类截图）
  ├── 支付宝截图 → 找蓝色/蓝色品牌色、支付宝 Logo、"余额"关键字
  ├── 微信截图 → 找绿色/微信品牌色、"零钱"关键字
  ├── 银行卡截图 → 找银行卡号、持卡人姓名
  └── 无法识别 → 返回"未知截图类型"提示用户自行选择
  ↓
Step 2 - OCR 全图文字识别
  ├── EasyOCR.readtext(image)
  ├── 返回: [(bbox, text, confidence), ...] 列表
  └── 按 Y 坐标排序（从上到下）
  ↓
Step 3 - 关键字定位 + 金额提取
  ├── 遍历识别结果，匹配关键字字典
  ├── 对每个关键字 → 在附近区域找对应的金额数字
  └── 返回: {label: amount} 键值对
  ↓
Step 4 - 金额格式校验
  ├── 正则校验数字格式（允许整数、两位小数、千分位逗号）
  ├── 合理性检查（金额 > 0 且 < 10^8）
  └── 不合理 → 标记低置信度
  ↓
Step 5 - 置信度计算
  ├── 取所有相关识别片段的 OCR confidence 平均值
  ├── 单个字段 confidence = OCR置信度 × 格式校验系数
  └── < 0.8 标记待人工确认
  ↓
返回结构化结果: {channel, account_type, amount, confidence, detected_person}
```

#### Step 1 详解：截图类型分类

不用深度学习分类模型，直接用 OCR 文字结果做规则判断：

```python
def classify_screenshot(ocr_results):
    """
    ocr_results: [(bbox, text, conf), ...]
    returns: "alipay" | "wechat" | "bank_card" | "unknown"
    """
    all_text = " ".join([text for _, text, _ in ocr_results])
    
    # 支付宝特征
    alipay_keywords = ["余额", "余额宝", "支付宝", "基金", "总金额"]
    alipay_score = sum(1 for kw in alipay_keywords if kw in all_text)
    
    # 微信特征
    wechat_keywords = ["零钱", "零钱通", "微信", "钱包"]
    wechat_score = sum(1 for kw in wechat_keywords if kw in all_text)
    
    # 银行卡特征
    bank_keywords = ["卡号", "持卡人", "可用余额", "活期", "开户行", "***"]
    bank_score = sum(1 for kw in bank_keywords if kw in all_text)
    
    scores = {"alipay": alipay_score, "wechat": wechat_score, "bank_card": bank_score}
    best = max(scores, key=scores.get)
    return best if scores[best] >= 2 else "unknown"
```

#### Step 3 详解：关键字→金额匹配算法

核心难点：如何从 OCR 识别结果中找到"余额"旁边的数字。

**方法：空间邻近匹配**

```
给定关键字 "余额":
1. 找到 "余额" 的 bbox（边界框）
2. 在其右侧/下方区域内搜索数字文本
   右侧搜索区域: x从关键字右边界 → 右移 300px
                  y从关键字顶边 → 底边（同一行）
   下方搜索区域: x从关键字左边界 → 左右各 50px 误差
                  y从关键字底边 → 下移 100px
3. 对搜索到的候选数字：
   a. 取最近的一个（欧几里得距离最近）
   b. 验证数字格式（×××.×× 或 ×××,×××.××）
   c. 若符合 → 作为该关键字的金额

多字段截图的处理：
  支付宝截图中有 "余额" 和 "余额宝" 两个字段
  → 分别查找各自 bbox 附近的数字
  → 互不干扰
```

**特殊情况处理：**

| 情况 | 处理 |
|------|------|
| 同一关键字出现多次 | 取 Y 坐标最小的（通常为标题而非值） |
| 关键字区域无数字 | 扩大搜索范围到整行，再找不到则标记"未识别" |
| 数字带千分位逗号 | 去除逗号后解析：`1,234.56` → `1234.56` |
| 数字前有人民币符号 | 忽略 `¥` / `￥` 符号 |
| 大数字带"万"字 | 识别"万"关键字后乘以 10000：`5.2万` → `52000` |

#### 各类型截图的具体字段映射

**支付宝截图**（首页/余额页面）：
| 图片区域 | 关键字 | 目标字段 | 示例 |
|---------|--------|---------|------|
| 顶部卡片 | "余额" 或 "总资产" | alipay_total | 655869.27 |
| 基金区块 | "基金" | alipay_fund | 12246.60 |
| 余额宝区块 | "余额宝" | alipay_yuebao | 36103.42 |
| 余额区块 | "余额"（特定位置） | alipay_balance | 906.19 |

**微信截图**（钱包页面）：
| 图片区域 | 关键字 | 目标字段 | 示例 |
|---------|--------|---------|------|
| 顶部 | "零钱" 附近数字 | wechat_balance | 2201.37 |
| 零钱通 | "零钱通" 或 "七日年化" 上方数字 | wechat_licaitong | 3741.18 |

**银行卡截图**（手机银行/APP）：
| 图片区域 | 关键字 | 目标字段 | 示例 |
|---------|--------|---------|------|
| 账户详情 | "可用余额" 或 "活期余额" | bank_balance | 183472.24 |
| 卡号区域 | "卡号" 附近 | bank_card_no | 末尾4位(用于标识银行) |

#### 置信度计算细则

```python
def calculate_confidence(ocr_conf, amount_text):
    """
    综合置信度 = OCR原始置信度 × 格式修正系数
    
    格式修正系数：
    - 标准金额格式（1234.56）→ 1.0
    - 含千分位逗号（1,234.56）→ 1.0（格式正常）
    - 无小数位（1234）→ 0.9（可能是整数，也可能漏了小数位）
    - 含特殊字符（1,234.56元）→ 0.95（多了单位）
    - 含字母数字混合 → 0.3（大概率误识别）
    
    最终置信度 = min(ocr_conf * format_factor, 1.0)
    """
```

阈值策略：
- confidence >= 0.9 → 自动接受（绿色标识）
- 0.7 <= confidence < 0.9 → 建议人工核对（黄色标识）
- confidence < 0.7 → 必须人工输入（红色标识）

#### 后续优化方向

1. **模板匹配加速**：对于同型号手机的固定位置截图，可以用模板匹配先定位
2. **缓存识别结果**：同一张图重复识别时直接返回缓存
3. **持续改进**：用户修正确认的结果可以收集起来做参考，下次同类型截图优先使用已验证的模板

### 前端组件树

```
App
├── AppLayout (Sider + Content)
│   ├── SiderMenu (导航菜单)
│   └── Content (路由出口)
│
├── DashboardPage
│   ├── StatCards (4 个 Statistic 卡片)
│   ├── TrendChart (ECharts 折线图 - 近12月)
│   ├── CategoryPie (ECharts 饼图 - 本月支出分类)
│   └── CompareBar (ECharts 柱状图 - 两人对比)
│
├── ImportPage
│   └── ImportSteps (Ant Design Steps)
│       ├── StepMonthPerson (步骤1: 选月份+人员)
│       ├── StepUpload (步骤2: 拖拽上传)
│       ├── StepPreview (步骤3: 预览表格)
│       └── StepConfirm (步骤4: 确认结果)
│
├── IncomePage (OCR)
│   ├── UploadArea (多图上传)
│   └── ResultCards[] (识别结果卡片)
│       ├── ImagePreview (缩略图)
│       └── FieldEditor[] (可编辑字段)
│
├── AnalysisPage
│   ├── MonthFilter (月份选择器)
│   ├── CategoryTable (分类汇总表)
│   └── CategoryTrend (分类趋势图)
│
└── ExportPage
    ├── MonthRangePicker (月份范围选择)
    └── DownloadButton (下载按钮)
```

### 设计风格与 ECharts 样式参考

#### 整体风格定位

暗色主题 + 蓝金配色，定位"家庭财务看板"而非"企业报表"：

```
背景色:    #141414 (Ant Design 暗色默认)
卡片背景:  #1f1f1f
卡片边框:  #303030
文字主色:  #e5e5e5
文字次要:  #a0a0a0

主色:      #1677ff (Ant Design 主题蓝)
辅助色:    #00d4ff (青色)
金色:      #ffd700 (用于标注突出数据)
暖橙:      #ff8800 (用于警告/注意)
红色:      #ff4d4f (支出超限)
绿色:      #52c41a (收入/攒钱)
```

#### ECharts 主题使用策略

ECharts 5 内置只有 `'dark'` 和 `'light'` 两个主题，其他需要额外加载：

```typescript
// 方式一（推荐）: 直接用内置 dark 主题 + 自定义调色板
const chart = echarts.init(dom, 'dark', {
  renderer: 'canvas'
});

// 方式二: 从 theme builder 下载自定义主题
// https://echarts.apache.org/zh/theme-builder.html
import theme from './theme/finance-dark.json';
echarts.registerTheme('finance-dark', theme);
const chart = echarts.init(dom, 'finance-dark');
```

**推荐方案**：用内置 `'dark'` 为基础 + 手动覆盖调色板，避免额外加载主题文件。

#### 各图表的具体配置参考

**1. 月度收支趋势折线图**

```typescript
// 风格参考: Ant Design Pro 的 Timeline 折线图
option = {
  backgroundColor: 'transparent',  // 由 Ant Design 卡片提供背景
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(30,30,30,0.9)',
    borderColor: '#303030',
  },
  legend: {
    data: ['收入', '支出', '本月攒'],
    textStyle: { color: '#a0a0a0' },
  },
  xAxis: {
    type: 'category',
    axisLine: { lineStyle: { color: '#303030' } },
    axisLabel: { color: '#a0a0a0' },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#252525', type: 'dashed' } },
    axisLabel: { color: '#a0a0a0' },
  },
  series: [
    {
      name: '收入',
      type: 'line',
      smooth: true,           // 平滑曲线
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2 },
      areaStyle: {            // 渐变填充区域
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(82,196,26,0.3)' },  // 收入绿
            { offset: 1, color: 'rgba(82,196,26,0.01)' },
          ]
        }
      },
      itemStyle: { color: '#52c41a' },  // 收入绿
    },
    {
      name: '支出',
      type: 'line',
      smooth: true,
      symbol: 'diamond',
      symbolSize: 6,
      lineStyle: { width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(255,77,79,0.3)' },  // 支出红
            { offset: 1, color: 'rgba(255,77,79,0.01)' },
          ]
        }
      },
      itemStyle: { color: '#ff4d4f' },  // 支出红
    },
  ],
  grid: { left: 60, right: 20, top: 40, bottom: 30 },
};
```

**2. 本月支出分类占比饼图**

```typescript
// 风格参考: 环形饼图 + 标签置于外部
option = {
  tooltip: { trigger: 'item' },
  legend: {
    type: 'scroll',
    orient: 'vertical',
    right: 10,
    textStyle: { color: '#a0a0a0' },
  },
  series: [{
    type: 'pie',
    radius: ['40%', '65%'],          // 环形
    center: ['35%', '50%'],
    avoidLabelOverlap: true,
    label: {
      show: true,
      position: 'outside',
      formatter: '{b}: {d}%',        // 显示分类名称 + 百分比
      color: '#c0c0c0',
    },
    labelLine: { lineStyle: { color: '#555' } },
    // 11 个分类的配色（蓝绿橙紫顺序）
    color: [
      '#1677ff', '#52c41a', '#ff8800', '#722ed1',
      '#13c2c2', '#ff4d4f', '#faad14', '#2f54eb',
      '#eb2f96', '#a0d911', '#434343',
    ],
    emphasis: {
      itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
    },
  }],
};
```

**3. 两人支出对比柱状图**

```typescript
// 风格参考: 分组柱状图
option = {
  tooltip: { trigger: 'axis' },
  legend: {
    data: ['BB', 'LN'],
    textStyle: { color: '#a0a0a0' },
  },
  xAxis: {
    type: 'category',
    data: ['餐饮', '购物', '交通', '娱乐', ...],
    axisLabel: { color: '#a0a0a0', rotate: 30 },  // 分类名旋转
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#252525' } },
  },
  series: [
    {
      name: 'BB',
      type: 'bar',
      barWidth: '30%',
      itemStyle: {
        color: '#1677ff',              // BB 用蓝色
        borderRadius: [4, 4, 0, 0],    // 圆角柱
      },
    },
    {
      name: 'LN',
      type: 'bar',
      barWidth: '30%',
      itemStyle: {
        color: '#52c41a',              // LN 用绿色
        borderRadius: [4, 4, 0, 0],
      },
    },
  ],
};
```

**4. 资产总览图**

```typescript
// 风格参考: 多层嵌套饼图 或 堆叠条形图
// 用堆叠条形展示各人资产构成
option = {
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'value',
    axisLabel: { color: '#a0a0a0' },
    splitLine: { lineStyle: { color: '#252525' } },
  },
  yAxis: {
    type: 'category',
    data: ['BB', 'LN'],
    axisLabel: { color: '#e5e5e5', fontSize: 14 },
  },
  series: [{
    type: 'bar',
    stack: 'total',
    name: '余额宝',
    itemStyle: { color: '#1677ff' },
  }, {
    type: 'bar',
    stack: 'total',
    name: '基金',
    itemStyle: { color: '#722ed1' },
  }, {
    type: 'bar',
    stack: 'total',
    name: '银行卡',
    itemStyle: { color: '#13c2c2' },
  }, {
    type: 'bar',
    stack: 'total',
    name: '零钱通',
    itemStyle: { color: '#52c41a' },
  }],
};
```

**5. 分析页分类占比趋势图**

```typescript
// 风格参考: 堆叠面积图，展示各分类随时间的变化
option = {
  tooltip: { trigger: 'axis' },
  legend: { data: ['餐饮', '购物', '交通', ...] },
  xAxis: { type: 'category' },
  yAxis: { type: 'value' },
  series: [
    {
      type: 'line',
      stack: 'total',              // 堆叠展示
      areaStyle: {},
      smooth: true,
    },
    // ... 每个分类一个 series
  ],
};
```

#### 调色板速查

| 用途 | ECharts color 值 |
|------|-----------------|
| BB 代表色 | `#1677ff` (蓝色) |
| LN 代表色 | `#52c41a` (绿色) |
| 收入 | `#52c41a` |
| 支出 | `#ff4d4f` |
| 本月攒 | `#1677ff` |
| 预警/超支 | `#ff8800` |
| 11 分类饼图 | `['#1677ff','#52c41a','#ff8800','#722ed1','#13c2c2','#ff4d4f','#faad14','#2f54eb','#eb2f96','#a0d911','#434343']` |
| 资产渐变 | `['#1677ff','#722ed1','#13c2c2','#52c41a','#faad14']` |

#### 参考资源链接

1. **ECharts 官方示例库**: https://echarts.apache.org/examples/zh/ — 找"折线图""饼图""柱状图"分类
2. **ECharts 主题编辑器**: https://echarts.apache.org/zh/theme-builder.html — 在线创建和下载主题 JSON
3. **Ant Design 暗色主题**: Ant Design ConfigProvider `theme.darkAlgorithm` 自动处理
4. **ECharts 内置 dark 主题**: `echarts.init(dom, 'dark')` 开箱即用，不需额外下载

### 前端其他关键配置

#### 路由模式

```typescript
// 使用 HashRouter（本地文件打开时 BrowserRouter 会刷新 404）
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

<HashRouter>
  <Routes>
    <Route path="/" element={<AppLayout />}>
      <Route index element={<DashboardPage />} />
      <Route path="import" element={<ImportPage />} />
      <Route path="income" element={<IncomePage />} />
      <Route path="analysis" element={<AnalysisPage />} />
      <Route path="export" element={<ExportPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
</HashRouter>
```

#### package.json 关键字段

```json
{
  "name": "family-accounting",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "antd": "^5.20.0",
    "@ant-design/icons": "^5.4.0",
    "echarts": "^5.5.0",
    "echarts-for-react": "^3.0.2",
    "zustand": "^4.5.0",
    "axios": "^1.7.0",
    "dayjs": "^1.11.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0",
    "less": "^4.2.0"
  }
}
```

#### 前端状态持久化

```typescript
// zustand 中间件：localStorage 持久化当前月份和已加载数据
// 刷新页面后无需重新请求
import { persist } from 'zustand/middleware';

const useAppStore = create(
  persist(
    (set, get) => ({
      currentMonth: dayjs().format('YYYY.M'),  // 默认当前月
      // ... 其他状态
    }),
    {
      name: 'family-accounting-storage',  // localStorage key
      partialize: (state) => ({
        currentMonth: state.currentMonth,
        availableMonths: state.availableMonths,
      }),  // 只持久化关键字段，图表数据不持久化
    }
  )
);
```

#### 金额格式化工具

```typescript
// utils/format.ts — 全站统一金额显示
export function formatMoney(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// 使用示例
formatMoney(1234.5)    // → "¥1,234.50"
formatMoney(-3853.86)  // → "¥-3,853.86"
formatMoney(0)         // → "¥0.00"
```

### Zustand Store 设计

```typescript
interface AppState {
  // 当前月份
  currentMonth: string;
  setCurrentMonth: (month: string) => void;

  // 可用月份列表
  availableMonths: string[];
  fetchAvailableMonths: () => Promise<void>;

  // 导入流程状态
  importStep: number;
  importLoading: boolean;
  previewData: Transaction[];
  setImportStep: (step: number) => void;
  setPreviewData: (data: Transaction[]) => void;

  // OCR 流程状态
  ocrResults: OcrResult[];
  setOcrResults: (results: OcrResult[]) => void;

  // 仪表盘数据
  summary: MonthlySummary | null;
  expenses: ExpenseData | null;
  fetchSummary: (month: string) => Promise<void>;
  fetchExpenses: (month: string) => Promise<void>;

  // 全局 loading
  globalLoading: boolean;
}
```

### API 错误响应契约

所有 API 错误统一返回格式：

```json
{
  "success": false,
  "error": {
    "code": "INVALID_FILE_FORMAT",
    "message": "不支持的文件格式，仅接受 .csv 和 .xlsx",
    "details": {}
  }
}
```

常见错误码：
| code | 含义 |
|------|------|
| INVALID_FILE_FORMAT | 文件格式不支持 |
| PARSE_ERROR | 文件解析失败 |
| OCR_LOW_CONFIDENCE | OCR 置信度低于阈值 |
| DUPLICATE_TRANSACTION | 检测到重复交易 |
| CATEGORY_NOT_FOUND | 分类映射失败 |
| FILE_TOO_LARGE | 文件超过大小限制 |

### 重复交易检测

```python
# 以 交易订单号 + 金额 为唯一键
def find_duplicates(new_transactions, existing_transactions):
    existing_ids = {(t.order_id, t.amount) for t in existing_transactions}
    duplicates = [t for t in new_transactions if (t.order_id, t.amount) in existing_ids]
    return duplicates
```

导入确认前，preview 接口返回重复交易列表供用户确认是否跳过。

---

## 人员归属策略

系统需要区分夫妻两人（BB/斌 和 LN/纳）的数据。根据场景不同，采用分级策略：

### 导入支出：手动选择 + 文件名自动提示

```
用户操作：在步骤1选择「BB」或「LN」
  ↓
上传文件 → 后端预处理
  ↓
系统自动检测：文件名是否包含 ln/xzb 目录名或人员昵称
  ├── 检测到 "ln" 或 "FairyDust" → 自动匹配为 LN（前端标注提示）
  ├── 检测到 "xzb" 或 "{BB_NAME}" → 自动匹配为 BB（前端标注提示）
  └── 无法识别 → 沿用用户手动选择的人员
  ↓
preview 返回时，每条交易记录已标记 person 字段
```

**文件内容自动检测规则**（辅助判断）：
| 文件类型 | 检测方法 |
|---------|---------|
| 支付宝 CSV | 文件头解析账户信息 |
| 微信 xlsx | 文件头解析昵称 |
| 文件名 | 含 `xzb` / `斌` → BB；含 `ln` / `娜` / `Fairy` → LN |

**API `POST /api/import/preview` 请求扩展**：
```json
{
  "person": "BB",
  "month": "2026.1",
  "files": [
    {"name": "支付宝交易明细...csv", "data": "<base64>"},
    {"name": "微信支付账单流水...xlsx", "data": "<base64>"}
  ],
  "auto_detect": true
}
```

响应中每条 transaction 携带 `detected_person` 和 `person_match_confirmed` 字段。

### OCR 截图：分人上传

OCR 场景中，截图天然包含账户归属信息，采用两级策略：

**第一级：前端分人上传**
```
/income 页面
├── 顶部 Tab 切换：「斌的截图」 / 「纳的截图」
│     （当前激活 Tab 决定了上传图片的人员归属）
└── 上传区域：激活 Tab 对应的人员
```

**第二级：OCR 自动识别账户归属（辅助验证）**
```
OCR 识别截图后，额外检测账户标识信息：
├── 支付宝截图 → 识别头像下方的昵称/账户名
│     "{BB_NAME}" → BB
│     "{LN_NAME}" / "LN" → LN
├── 微信截图 → 识别顶部昵称
└── 银行卡截图 → 识别持卡人姓名（如有）
```

当 OCR 识别的归属与用户选择的 Tab 不一致时，前端弹出确认提示。

### 数据存储中的区分

所有数据模型中 `person` 字段为必填，取值 `"BB"` 或 `"LN"`。

**缓存文件 JSON 结构**：
```json
{
  "month": "2026.1",
  "income": {
    "BB": [{ "time": "...", "amount": 15469.66, ... }],
    "LN": [{ "time": "...", "amount": 3000, ... }]
  },
  "expenses": {
    "BB": [/* 含 person="BB" 的交易 */],
    "LN": [/* 含 person="LN" 的交易 */]
  },
  "analysis": {
    "BB": { "购物": 3719.88, "餐饮": 872.15, ... },
    "LN": { "购物": 672.91, "餐饮": 1308.86, ... }
  },
  "assets": {
    "BB": { /* 理财数据 */ },
    "LN": { /* 理财数据 */ }
  }
}
```

### Excel 输出中的区分

对应模板中的人员标注方式：

| Sheet | 区分方式 |
|-------|---------|
| 收入 | A 列文字标注"斌"/"纳" |
| 支出明细 | A 列合并单元格标注"斌"/"纳"，数据分两个连续区域 |
| 支出分析 | C 列 LN 支出，D 列 BB 支出 |
| 理财 | Row 4 为 BB 区，Row 9 为 LN 区 |

后端写入时根据 `person` 字段自动分配到对应的行/区域。

---

## 交互逻辑

### 通用交互规则

1. **全局 loading**：所有 API 请求期间，侧边栏保持不变，内容区域显示 Ant Design Spin
2. **空态**：首次使用无数据时，每个页面显示空状态指引（Empty 组件 + 引导文字）
3. **错误提示**：API 错误统一通过 Ant Design `message.error()` 弹出；网络错误显示重试按钮
4. **月份切换**：仪表盘和分析页支持月份切换，切换时内容区域刷新（保留侧边栏和顶部栏）

### 导入支出流程

```
[用户操作流]
1. 侧边栏点击「导入支出」→ 进入 /import
2. 步骤1：选择月份（默认当前月）
   + 选择人员 → 使用「BB / LN」两个大按钮（而非下拉），选中后高亮
   + 选择方式：手动点击。后端 auto_detect 结果会作为辅助提示显示
     例：选中"BB"后下方提示"检测到微信昵称 ✓"
   + 支持同时选中"两人一起"模式 → 进入批量上传（每人各自传自己的文件）
3. 步骤2：文件拖拽上传区域
   - 支持支付宝 CSV 和微信 xlsx 同时上传（可多个文件）
   - 上传后立即调用 preview API，附带 person + auto_detect
   - 上传中显示进度条
   - 文件格式错误 → 红色提示，阻止下一步
4. 步骤3：预览解析结果表格
   - 每行显示：时间 | 原始分类 | 映射分类(下拉可编辑) | 金额 | 支付方式 | 描述
   - 映射分类列：默认显示自动分类结果，下拉可选择其他分类
   - 未匹配分类行：行背景标红，下拉框为空（强制用户选择）
   - 底部统计栏：总笔数、总支出金额、未匹配数
   - **人员匹配校验**：若后端 auto_detect 的归属与用户选择不一致
     → 在表格顶部显示警告横幅（如：检测到此文件是 LN 的支付宝，是否更正？）
   - 若有重复交易：额外显示重复交易警告列表
   - 点击「上一步」回到上传步骤，保留文件
5. 步骤4：确认导入
   - 显示「即将导入 X 笔支出到 {月份} - {人员}」总结
   - 点击「确认导入」→ 调用 confirm API
   - 确认中按钮 loading
   - 成功 → 成功提示 +「去仪表盘查看」按钮
   - 失败 → 错误详情 +「重试」按钮

[边界状态]
- 用户选"BB"但上传了 LN 的微信文件 → auto_detect 在步骤3发出警告
- 两人一起上传时，其中一人文件解析失败 → 成功部分继续，失败部分单独标红
- 网络中断 → 步骤3/4 显示断网提示，保留已解析数据
- 文件解析部分失败 → 成功行正常展示，失败行标红显示错误原因
- 用户上传非支付宝/微信文件 → 格式校验拒绝
- 已导入过的月份 → 提示"该月份已有数据，继续将追加"

[页面间跳转]
- 导入成功后 → 提供跳转到仪表盘的快捷操作
- 点「上一步」→ 返回上传步骤，文件和解析结果不清空
```

### OCR 识别收入/余额流程

```
[用户操作流]
1. 侧边栏点击「识别收入」→ 进入 /income
2. 选择月份（默认当前月）
3. 选择人员 → 顶部 Tab 切换：「斌的截图」 / 「纳的截图」
   - 当前 Tab 决定上传图片的人员归属
   - Tab 切换时不清空已上传和已识别的结果
   - 每张卡片上标注人员标签（如"斌 · 支付宝"）
4. 多图上传区域（支持批量）
   - 每张图上传后自动调用 OCR
   - 识别中显示缩略图 + 加载骨架屏
5. 识别结果卡片列表：
   - 每张图一个卡片，卡片头部显示来源（支付宝/微信/银行卡）和人员
   - 卡片内含：缩略图 + 识别出的字段列表
   - 每个字段：标签（如"余额宝"）+ 置信度徽标 + 金额输入框
   - 置信度 < 0.8 的字段标黄提示
   - **归属校验**：OCR 识别到账户昵称与当前 Tab 人员不匹配时
     → 卡片上显示黄色横幅（例："检测到此截图可能是纳的支付宝，是否切换？"）
6. 用户逐字段核对并手动修正
7. 点击「确认保存」→ 调用 ocr/confirm API
   - API 请求中带入 person 字段，后端写入收入 sheet + 理财 sheet
   - 成功 → 提示 + 跳转到仪表盘

[边界状态]
- 截图模糊/光线差 → OCR 返回低置信度，字段标黄，用户手动填入
- 非财务截图 → OCR 识别不出有效金额 → 提示"未识别到有效金额"
- 部分字段成功部分失败 → 成功字段正常显示，失败字段留空标注
- 图片过大 → 前端压缩后再上传（限制单张 < 5MB）
- OCR 识别到归属与 Tab 不一致 → 提供"一键切换"按钮
- 同一人员、同一月份重复提交资产数据
  → 后端按"最近提交覆盖"处理，保留最新版本
```

### 仪表盘浏览

```
[用户操作流]
1. 侧边栏点击「仪表盘」→ 进入 / （默认页）
2. 自动加载最近月份数据
3. 页面布局（从上到下）：
   a. 月份选择器（右上角，下拉切换）
   b. 四张统计卡片（总资产、本月收入、本月支出、本月攒）
   c. 月度收支趋势折线图（近 12 月）
      - X 轴：月份
      - Y 轴：金额
      - 两条线：收入、支出
      - hover 显示具体数值
   d. 本月支出分类占比饼图
      - 点击某分类 → 下钻到支出分析页并筛选该分类
   e. 两人支出对比柱状图（按分类分组）

[边界状态]
- 只有一个月数据 → 折线图只显示一个点，提示"更多数据将展示趋势"
- 无收入数据 → 收入卡片显示 0，折线图收入线为空
- 数据加载失败 → 显示重试按钮 + 错误详情
```

### 支出分析交互

```
[用户操作流]
1. 侧边栏点击「支出分析」→ 进入 /analysis
2. 默认显示最近月份数据
3. 页面布局：
   a. 顶部筛选栏：月份（下拉）+ 人员（全部/BB/LN 切换）
   b. 分类汇总表格：11 行分类 + 合计行
      - 列：分类 | LN 支出 | BB 支出 | 总支出 | 占比
      - 点击分类行 → 展开该分类下的交易明细
   c. 分类占比趋势图（ECharts）
      - 月份筛选变化时自动刷新
      - 可选择查看单个分类的趋势

[交互细节]
- 月份切换 → 表格和图一起刷新
- 人员筛选变化 → 表格金额和占比重新计算
- 分类行展开 → 行下直接展开子表格（Ant Design Table expandable）
- 占比列：进度条样式显示（BB/LN 各占一半的堆叠进度条）
```

### 导出交互

```
[用户操作流]
1. 侧边栏点击「导出」→ 进入 /export
2. 月份范围选择（默认单月，可选多个月份范围）
3. 选择月份后显示：
   - 该月份收入/支出汇总预览
   - 预估文件大小
4. 点击「下载 Excel」
   - 后端生成 xlsx
   - 前端下载
   - 下载中按钮 loading

[边界状态]
- 选择多个月份 → 后端打包成 zip（内含多个 xlsx）
- 选中月份无数据 → 提示"该月份无数据"
```

### 导航与页面关系

```
                    ┌──────────────┐
                    │  侧边栏导航    │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┬──────────────┐
          ▼                ▼                ▼              ▼
     / 仪表盘        /import 导入      /income OCR     /analysis 分析
          │                │                               ▲
          │    导入成功 ───┘         饼图点击分类 ──────────┘
          │    自动跳转
          ▼
     /export 导出
```

---

## 技术栈

| 层 | 技术 | 理由 |
|----|------|------|
| 后端 | Python 3.11 + Flask | 已安装，轻量 |
| Excel | openpyxl 3.1.5 | 已安装，兼容 xlsx 格式 |
| OCR | PaddleOCR（先试） | 中文识别率高，离线可用；回退 EasyOCR |
| 前端 | React 18 + TypeScript | — |
| 构建 | Vite 5 | 快速 HMR |
| 样式 | Less | CSS 预处理 |
| 图表 | ECharts 5 | 丰富图表类型 |
| UI | Ant Design 5 | 表格/表单/上传 |
| 状态管理 | Zustand | 轻量 |
| 数据缓存 | JSON 文件缓存 | 轻量无依赖，无需额外数据库 |

---

## 目录结构

```
E:\tools\family-accounting\
├── backend/
│   ├── app.py                 # Flask 入口 + 路由
│   ├── config.py              # 配置（路径、分类映射、人员配置）
│   ├── requirements.txt       # 依赖清单
│   ├── services/
│   │   ├── excel_reader.py    # 解析支付宝 CSV + 微信 xlsx
│   │   ├── excel_writer.py    # 生成标准记账 xlsx
│   │   ├── classifier.py      # 支出分类映射引擎
│   │   └── ocr_service.py     # OCR 识别
│   ├── models/
│   │   └── schemas.py         # 数据结构定义（dataclass）
│   └── uploads/               # 上传文件临时目录
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── types/index.ts     # TypeScript 类型定义
│       ├── api/index.ts       # API 调用层
│       ├── store/             # Zustand stores
│       │   └── useAppStore.ts
│       ├── components/        # 通用组件
│       │   ├── AppLayout.tsx
│       │   └── StatCard.tsx
│       ├── pages/
│       │   ├── Dashboard/     # 总览仪表盘（ECharts）
│       │   ├── Import/        # 导入支出明细
│       │   ├── Income/        # OCR 识别收入/余额
│       │   ├── Analysis/      # 支出分析
│       │   └── Export/        # 导出 Excel
│       └── styles/
│           ├── global.less
│           └── variables.less
└── data/
    ├── templates/             # Excel 模板（空模板，用于新建月份）
    └── history/               # 历史月份数据目录
```

---

## 分类映射规则

### 支付宝分类映射

| 支付宝原始分类 | 目标分类 | 特殊逻辑 |
|---------------|---------|---------|
| 日用百货 | 购物（网购） | — |
| 家居家装 | 购物（网购） | — |
| 服饰美容 | 购物（网购） | — |
| 餐饮美食 | 餐饮 | — |
| 文化休闲 | 娱乐 | — |
| 交通出行 | 交通 | — |
| 保险 | 医疗（保险、核酸等） | — |
| 运动户外 | 娱乐 | — |
| 数码家电 | 购物（网购） | — |
| 充值缴费 | 充值缴费 | — |
| 生活服务 | 生活服务 | — |
| 教育 | 其他 | — |
| 其他 | 其他 | — |

### 微信分类映射

| 微信原始分类 | 目标分类 | 特殊逻辑 |
|-------------|---------|---------|
| 商户消费 | → 分析备注判断 | 含"餐饮"→餐饮；"超市"→购物；默认→其他 |
| 微信红包（单发） | 转账（红包、人情） | — |
| 二维码收款 | 收入（不计入支出） | — |
| 零钱提现 | 跳过（中性交易） | — |
| 转账 | 转账（红包、人情） | — |
| 充值缴费 | 充值缴费 | — |

### 二次关键词匹配规则

对于"商户消费"等泛分类，根据商品描述/备注中的关键词二次判断：
- 含"餐饮/美食/餐厅/饭/菜/食/饮/茶/咖啡" → 餐饮
- 含"超市/百货/购物/商品/日用" → 购物（网购）
- 含"交通/地铁/公交/打车/加油/停车/高铁" → 交通
- 含"医疗/医院/医保/药/体检" → 医疗
- 含"缴费/话费/水电/物业/煤气" → 充值缴费
- 金额 > 2000 且含"装修/家具/家电/大件" → 家庭支出

---

## Excel 写入详细规范

### 输出文件结构（对应 家庭收支2026.1.xlsx）

```
[总 Sheet]
  D2 = 月份文字（如"1月"）
  Row 3: 表头（上月余额 | 收入 | 支出 | 本月攒 | 已有总额）
  Row 4: BB 数据（含公式引用）
  Row 5: LN 数据（含公式引用）
  Row 6: 合计行（SUM 公式）
  Row 7: 外借资产
  Row 8: 家庭资产公式

[收入 Sheet]
  BB 数据: Row 2 起，A列标注"斌"
  LN 数据: 接续行，A列标注"纳"
  列: 人员 | 入账时间 | 账务类型 | 收入(+元) | 支付渠道 | 对方账户 | 备注

[支出明细 Sheet]
  BB 数据: 从 Row 2 起，A列合并单元格"斌"
  LN 数据: 从 Row 61 起（示例），A列合并单元格"纳"
  列: 人员(合并) | 出账时间 | 账务类型 | 支出(-元) | 支付渠道 | 备注

[支出分析 Sheet]
  Row 2: 表头（账务类型 | LN支出 | BB支出 | 总支出）
  Rows 3-13: 11 个大类
  Row 14: SUM 合计行

[理财 Sheet]
  上半区: BB 资产（Row 4）
  下半区: LN 资产（Row 9）
  具体银行账户列名可配置
```

### 跨月数据链：上月余额的计算

总 Sheet 中的"上月余额"（C4=BB, C5=LN）依赖上个月的"已有总额"（G4/G5）：

```
当月数据  = 从导入/OCR 获得
上月余额  = 上个月的"已有总额"

具体逻辑:
  新创建 1 月文件 → "上月余额"手动填写（首次使用）
  创建 2 月文件 → 自动读取 1 月文件的 G4(G5) 作为 C4(C5)
  创建 3 月文件 → 自动读取 2 月文件的 G4(G5) 作为 C4(C5)
  ...

excel_writer.py 中:
  def calculate_last_balance(month: str, person: str) -> float:
      prev_month = get_previous_month(month)  # "2026.2" → "2026.1"
      prev_data = data_store.get_month(prev_month)
      if prev_data:
          return prev_data.assets[person].total  # 上月的已有总额
      # 若上个月没有数据（首次使用）
      # → 从已有 xlsx 中读取
      # → 若都没有 → 返回 0 并要求用户手动填写
```

缓存 JSON 中额外存储 `last_balance` 字段实现快速读取。

### 空模板生成策略

`data/templates/empty_book.xlsx` 用于新建月份时作为基准：

```
方式: 复制 `家庭收支2026.1.xlsx` 为基础，清空数据行，保留结构和公式
     → 用 openpyxl 脚本生成:
       1. 加载模板
       2. 清空收入 Sheet 中 Row 2+ 的数据
       3. 清空支出明细 Sheet 中 Row 2+ 的数据
       4. 清空支出分析 Sheet 中 Rows 3-13 的数据
       5. 清空理财 Sheet 中各人的金额数据
       6. 保留所有公式、合并单元格、格式
       7. 另存为 empty_book.xlsx

  首次使用新建月份时:
    复制 empty_book.xlsx → 家庭收支{month}.xlsx
    然后填充数据
```

---

## 分步实施计划

### 运行环境要求

| 环境 | 版本 | 说明 |
|------|------|------|
| Python | 3.11+ | `python` (ensure in PATH) |
| Node.js | 18+ (推荐 20 LTS) | 需要 npm 9+ |
| pip | 24+ | — |

### 后端依赖版本（requirements.txt）

```txt
flask==3.1.3
flask-cors==5.0.1
openpyxl==3.1.5
easyocr==1.7.2
pillow==11.1.0
python-magic-bin==0.4.14
gunicorn==23.0.0
# 注: easyocr 会自动安装 torch，若需 PaddleOCR 可追加:
# paddlepaddle==3.0.0
# paddleocr==2.9.1
```

### Flask 配置项

```python
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 最大上传 16MB
app.config['UPLOAD_FOLDER'] = 'uploads/'
app.config['DATA_FOLDER'] = '../data/'
```

### 文件上传与清理策略

| 场景 | 处理 |
|------|------|
| 上传文件临时存储 | 存到 `uploads/`，文件名 `{timestamp}_{original}` |
| 预览后未确认 | 临时文件保留 1 小时后自动删除（后台线程清理） |
| 确认导入 | 临时文件立即删除 |
| OCR 临时图片 | 识别完成后立即删除 |
| 请求体传输方式 | 大文件（>1MB）用 multipart/form-data，小文件用 base64 |

---

### Phase 0: 环境准备（~30min）

- [x] 确认 Python 3.11 + openpyxl + Flask 已安装
- [ ] 确认 Node.js 18+ 已安装
- [ ] 创建 `backend/` 目录结构
- [ ] 创建 `frontend/` 前端项目（npm create vite）
- [ ] 创建 `data/` 目录（templates/ + history/）
- [ ] 配置 `.claude/settings.json` 权限

### Phase 1: 后端核心（预计 4h）

**Step 1.1: 数据模型 + 配置文件**
- 文件: `backend/models/schemas.py`
  - Transaction, IncomeRecord, AssetSnapshot 等 dataclass
  - JSON 序列化/反序列化
- 文件: `backend/config.py`
  - 分类映射字典
  - 路径配置
  - Excel 模板配置（各 sheet 列映射、单元格引用）

**Step 1.2: Excel 读取服务**
- 文件: `backend/services/excel_reader.py`
  - `parse_alipay_csv(path)` → `List[Transaction]`
    - 跳过前 24 行元数据
    - GBK 编码
    - 列名匹配（不依赖列位置）
    - 过滤"已退款"等无效交易
    - 中性交易（零钱提现等）标记跳过
  - `parse_wechat_xlsx(path)` → `List[Transaction]`
    - 跳过前 16 行元数据
    - 列名匹配
    - 商户消费 → 备注关键词二次分类
  - `auto_detect_person(path)` → str
    - 根据文件所在目录名（ln/xzb）归属人员
  - `read_existing_book(path)` → dict
    - 读取已有 xlsx 内容，用于增量更新

**Step 1.3: 分类映射引擎**
- 文件: `backend/services/classifier.py`
  - `classify(transaction, custom_rules=None)` → str
  - 一级映射：按来源分类精确匹配
  - 二级映射：关键词匹配（"商户消费"等泛分类）
  - 用户自定义规则 JSON 文件
  - 未匹配 → "其他"（标记待手动修正）

**Step 1.4: Excel 写入服务**
- 文件: `backend/services/excel_writer.py`
  - `create_monthly_book(month, data)` → xlsx 文件
    - 从 `data/templates/empty_book.xlsx` 加载模板
    - 填充 5 个 Sheet 的数据，匹配模板格式
    - 写入公式（SUM、差额引用、跨 sheet 引用）
  - `append_to_existing(existing_path, new_data)` → 更新文件
    - 先读出现有内容（含旧公式）
    - 合并新数据到对应 Sheet
    - 更新公式范围（如 支出分析 的 SUM 行数变化）
  - 单元格格式、数字格式对齐（保留两位小数、千分位）
  - 支出分析 Sheet 的公式：
    - E3=E13: `=C{row}+D{row}`（每人分类相加得总支出）
    - Row 14: `=SUM(C3:C13)` / `=SUM(D3:D13)` / `=SUM(E3:E13)`

**Step 1.5: Flask API 入口**
- 文件: `backend/app.py`
  - CORS 支持
  - 所有 API 路由
  - 文件上传处理
  - 错误处理中间件
- `POST /api/import/preview` — 上传文件，返回解析 + 分类预览
- `POST /api/import/confirm` — 确认导入，写入 Excel
- `GET /api/categories` + `PUT /api/categories/mapping` — 分类管理

### Phase 2: OCR + 数据服务（预计 3h）

**Step 2.1: OCR 服务**
- 文件: `backend/services/ocr_service.py`
  - 集成 EasyOCR（优先，够用就不换 PaddleOCR）
  - 完整流水线：截图类型分类 → OCR 全图识别 → 关键字定位 → 金额提取 → 置信度校验
  - 截图类型自动判断：支付宝（余额/基金/余额宝）、微信（零钱/零钱通）、银行卡
  - 返回结构化结果 + 置信度 + 截图类型 + 人员归属识别
  - 图像预处理：对比度增强 + 锐化（PIL.ImageEnhance）
  - 置信度 < 0.8 标记待确认，< 0.7 强制人工输入
  - 若 EasyOCR 识别率不足 → 切换 PaddleOCR

**Step 2.2: 更多 API 路由**
- `POST /api/ocr/upload` — 上传截图，OCR 识别
- `POST /api/ocr/confirm` — 确认结果，写入收入 + 理财 sheet
- `GET /api/data/summary?month=` — 汇总数据
- `GET /api/data/expenses?month=` — 支出明细 + 分类分析
- `GET /api/data/assets?month=` — 资产数据
- `GET /api/data/income?month=` — 收入记录
- `GET /api/data/history` — 可用月份列表
- `GET /api/export?month=` — 下载 Excel

### Phase 3: 前端开发（预计 6h）

**Step 3.1: 项目初始化 + 布局**
- Vite + React 18 + TS + Less + Ant Design 5 + ECharts 5 + Zustand
- 入口配置：`package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- `main.tsx`: ReactDOM 渲染入口，包裹 ErrorBoundary
- `App.tsx`: React Router 路由配置：

  | 路径 | 页面组件 | 说明 |
  |------|---------|------|
  | `/` | `DashboardPage` | 仪表盘（默认页） |
  | `/import` | `ImportPage` | 导入支出 |
  | `/income` | `IncomePage` | OCR 识别收入 |
  | `/analysis` | `AnalysisPage` | 支出分析 |
  | `/export` | `ExportPage` | 导出 Excel |
  | `*` | `NotFoundPage` | 404 页面 |

- `components/AppLayout.tsx`: 侧边栏导航布局（Ant Design Layout）
  - 侧边栏选中状态与当前路由同步（`useLocation`）
  - 内容区域用 `Outlet`（React Router 嵌套路由）
- `components/ErrorBoundary.tsx`: 前端错误边界
  - 捕获 React 渲染异常
  - 显示友好错误页面 +「重试」按钮
  - 不影响侧边栏导航（用户可去其他页面）
- `styles/`: 全局样式 + 变量（暗色主题）
  - `variables.less`: 颜色变量、间距、字体
  
  ```less
  // variables.less 内容示例
  @primary-color: #1677ff;
  @dark-bg: #141414;
  @dark-card-bg: #1f1f1f;
  @text-color-dark: #e5e5e5;
  @border-radius: 8px;
  @spacing-sm: 8px;
  @spacing-md: 16px;
  @spacing-lg: 24px;
  ```
  
  - `global.less`: Ant Design 暗色主题变量覆盖 + 全局重置
  
  ```less
  // Ant Design 暗色主题配置（App.tsx 中用 ConfigProvider）
  import { ConfigProvider, theme } from 'antd';
  
  <ConfigProvider
    theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 8,
      },
    }}
  >
    <App />
  </ConfigProvider>
  ```

- `api/index.ts`: axios 封装，所有 API 调用
  - 基础 URL: `/api`（Vite proxy 转发到 Flask）
  - 统一错误处理（所有非 2xx 解析为统一错误格式）
  - 请求拦截器（可加 loading 计数）
- `store/useAppStore.ts`: Zustand store（当前月份、加载状态等）

**Step 3.1.1: 额外创建页面级文件**
- `pages/NotFound/index.tsx`: 404 页面（简单提示 +「回首页」链接）
- `components/ErrorBoundary.tsx`: 错误边界

**Step 3.2: 导入支出页面 `Import/`**
- Ant Design Steps 步骤向导：
  1. 选择月份（月份选择器）+ 人员（BB/LN）
  2. 拖拽上传文件区（同时支持支付宝 CSV + 微信 xlsx）
  3. 预览解析结果：Ant Design Table，每行可编辑分类下拉选择
  4. 确认导入按钮 → 调用 confirm API
- 错误/警告提示（识别失败的交易、未匹配分类）

**Step 3.3: OCR 收入识别页面 `Income/`**
- 多图上传区域
- 识别结果卡片列表：原图缩略图 + 字段键值对
- 每个识别字段带编辑输入框
- 手动修正后确认 → 更新资产数据

**Step 3.4: 仪表盘页面 `Dashboard/`**
- ECharts 图表（暗色主题配置）：
  - 月度收支趋势折线图（取所有历史月份数据）
  - 本月支出分类占比饼图
  - 两人支出对比柱状图（按分类分组）
  - 资产总览（理财各账户分布）
- Ant Design Statistic 卡片：总资产、本月收入、本月支出、本月攒

**Step 3.5: 支出分析页面 `Analysis/`**
- 月份筛选器（Select）
- 分类汇总表（同 支出分析 sheet 格式）
- 分类占比趋势（ECharts 折线/饼图切换）
- 两人消费习惯对比（雷达图或分组柱状图）

**Step 3.6: 导出页面 `Export/`**
- 选择月份（单选或多选范围）
- 点击下载 → 后端生成 xlsx

### Phase 4: 集成测试 + 优化（预计 2h）

**Step 4.1: 端到端测试**
- 用 2026.1 月真实数据跑通：导入 → 分类 → 写入 → 读取 → 导出
- 验证生成的 xlsx 与模板格式一致（用 openpyxl 比较 cell 结构）
- 验证 ECharts 图表数据与 Excel 一致

**Step 4.2: 错误处理优化**
- 文件格式校验（魔数检查，非仅后缀名）
- 脏数据处理（空行、BOM 头、不规则分隔符）
- OCR 置信度 < 0.8 时标记需人工确认
- 未匹配分类标记 + 手动修正提示
- 防重复导入（检测已存在的交易订单号）

**Step 4.3: 性能**
- 大文件解析 → 后端分页返回，前端虚拟滚动（Table virtual scroll）
- OCR 异步处理（后台线程，轮询结果）
- Excel 写入不用每次都全量写（增量更新）

---

## 验证标准

1. **导入准确性**：上传 2026.1 月 LN+BB 的支付宝+微信文件 → 解析结果与 `家庭收支2026.1.xlsx` 数据一致
2. **分类准确率**：自动分类准确率 > 90%，未匹配的明显错误可手动修正
3. **OCR 可用**：识别余额截图误差 < 5%
4. **Excel 兼容性**：生成的 xlsx 用 WPS/Excel 打开后格式与模板一致（字体、合并单元格、公式、数字格式）
5. **图表一致性**：ECharts 汇总数据与 Excel 数据一致
6. **全流程效率**：从导入到导出 < 5 分钟

---

## 已知风险与应对

| 风险 | 应对 |
|------|------|
| OCR 精度不足（尤其是支付宝/微信 UI 变化） | 提供手动编辑入口，EasyOCR 不够就换 PaddleOCR |
| `python3` 命令指向 WindowsApps 导致 exit code 49 | 使用完整 Python 路径或 `py` launcher |
| PaddleOCR CPU 版安装体积大 | 先试用 EasyOCR（轻量），精度不足再换 |
| 支付宝/微信导出格式变更 | 列名匹配而非列位置，有备用的"宽松模式"解析器 |
| 跨域问题 | Flask-CORS + Vite proxy 双重保障 |
| Windows 路径含中文 | 统一用 raw string 或 Path 对象处理 |
| Excel 文件被其他程序打开时写入失败 | 写入前检测文件锁，失败时提示"请先关闭 Excel" |
| OCR 大图片 OOM | 限制单张 < 5MB，上传前前端压缩 |
| 夫妻两人同月各导入一次，数据覆盖丢失 | 追加模式而非覆盖模式，按人员区隔数据行 |

---

## 文件创建清单（共 ~40 个文件）

### 后端（12 个）
- [ ] `backend/app.py`
- [ ] `backend/config.py`
- [ ] `backend/requirements.txt`
- [ ] `backend/models/__init__.py`
- [ ] `backend/models/schemas.py`
- [ ] `backend/services/__init__.py`
- [ ] `backend/services/data_store.py`       # 数据缓存层
- [ ] `backend/services/excel_reader.py`
- [ ] `backend/services/excel_writer.py`
- [ ] `backend/services/classifier.py`
- [ ] `backend/services/ocr_service.py`
- [ ] `backend/scripts/migrate_history.py`   # 历史数据迁移脚本
- [ ] `backend/scripts/generate_template.py` # 生成空模板脚本

### 前端（~24 个）
- [ ] `frontend/package.json`
- [ ] `frontend/vite.config.ts`
- [ ] `frontend/tsconfig.json`
- [ ] `frontend/index.html`
- [ ] `frontend/src/main.tsx`
- [ ] `frontend/src/App.tsx`
- [ ] `frontend/src/vite-env.d.ts`
- [ ] `frontend/src/types/index.ts`
- [ ] `frontend/src/api/index.ts`
- [ ] `frontend/src/store/useAppStore.ts`
- [ ] `frontend/src/components/AppLayout.tsx`
- [ ] `frontend/src/components/StatCard.tsx`
- [ ] `frontend/src/components/ErrorBoundary.tsx`
- [ ] `frontend/src/pages/Dashboard/index.tsx`
- [ ] `frontend/src/pages/Import/index.tsx`
- [ ] `frontend/src/pages/Income/index.tsx`
- [ ] `frontend/src/pages/Analysis/index.tsx`
- [ ] `frontend/src/pages/Export/index.tsx`
- [ ] `frontend/src/pages/NotFound/index.tsx`
- [ ] `frontend/src/styles/global.less`
- [ ] `frontend/src/styles/variables.less`

### 数据（3 个）
- [ ] `data/templates/empty_book.xlsx`（空模板，无数据行仅保留结构和公式）
- [ ] `data/history/`（目录，存放各月 xlsx 和 JSON 缓存）
- [ ] `data/history/index.json`（可用月份索引，启动时自动生成）

---

## 参考开源项目

### 1. Cashbook / lebook — 导入逻辑最接近

**仓库**: [dingdangdog/cashbook](https://github.com/dingdangdog/cashbook) + [doglee1024/lebook](https://github.com/dogelee1024/lebook)（前端UI）

**相关度**: ⭐⭐⭐⭐⭐ — 与本项目功能重合度最高

**可借鉴的设计**:

```
功能匹配度:
  支付宝/微信 CSV 导入    ✅ 完全一致
  自动分类映射            ✅ 完全一致
  分类预览 + 手动修正      ✅ 完全一致
  ECharts 图表分析         ✅ 完全一致
  多人账本                ✅ 支持
  OCR 识别                ❌ 不支持
  Excel 模板输出           ❌ 不支持
```

**关键参考点 — 导入解析逻辑**（cashbook-server 的核心）:
- CSV 解析时自动检测列头位置（跳过元数据行），与本项目的 `excel_reader.py` 设计思路一致
- 分类映射使用配置化的 `categoryMap` 字典，支持用户自定义
- 交易去重通过「交易单号+金额」联合判断

**可直接采用的思路**：
```python
# cashbook 风格的分类映射（可扩展为本项目的 classifier.py）
CATEGORY_MAP = {
    "alipay": {
        "餐饮美食": "餐饮",
        "日用百货": "购物",
        # ...
    },
    "wechat": {
        "商户消费": None,  # 需要二次判断
        # ...
    }
}
# 用户自定义映射存储为 JSON，加载时合并到默认映射中
```

### 2. Budget Planner — 技术栈最匹配

**仓库**: [Keyyard/budget-planner](https://github.com/Keyyard/budget-planner)

**相关度**: ⭐⭐⭐⭐ — React + Flask，与本项目技术栈完全一致

**可借鉴的设计**:

```
技术栈对比:
  前端 React         ✅ 一致
  后端 Flask         ✅ 一致
  数据库 SQLite      ✅ 一致（本项目用 JSON 缓存）
  图表 Chart.js      ⚠ 本项目用 ECharts
  JWT 认证           ❌ 本项目不需要（本地单机）
```

**关键参考点 — 前后端交互模式**：
- Flask 路由组织结构（蓝图 Blueprint 分层）
- React + Flask 的 API 调用封装模式
- 错误处理中间件模式（全局异常捕获 → JSON 响应）

**Flask 蓝图结构参考**（可直接用于本项目 `app.py`）：
```python
# budget-planner 风格的路由组织
from flask import Blueprint
api = Blueprint('api', __name__)

@api.route('/transactions')
def list_transactions():
    ...

@api.route('/transactions', methods=['POST'])
def create_transaction():
    ...
# 然后在 app.py 中 register_blueprint(api, url_prefix='/api')
```

### 3. Perfect Books — Python + React 本地方案

**仓库**: [matthew-s-jenkins/perfect-books](https://github.com/matthew-s-jenkins/perfect-books)

**相关度**: ⭐⭐⭐ — Python + React + SQLite，单机离线可用

**可借鉴的设计**：
- 复式记账的数据完整性校验思路
- SQLite 单文件数据库模式（如果以后 JSON 缓存不够用可迁移）
- 资产负债表的结构化生成逻辑

### 4. EasyAccounting — Ant Design UI 参考

**仓库**: [bringup113/EasyAccounting](https://github.com/bringup113/EasyAccounting)

**相关度**: ⭐⭐⭐ — React + Ant Design 前端架构参考

**可借鉴的设计**：
- Ant Design Pro 风格的页面布局（侧边栏 + 内容区）
- Steps 步骤向导在导入流程中的使用
- Table 可编辑单元格的实现方式（直接编辑 vs 弹窗编辑）
- 分类管理页面的 CRUD 交互

### 5. OCR 金额提取参考代码

**来源**: 百度开发者文章「Python发票OCR全流程：从图像到结构化数据解析」(2025)

**可借鉴的核心代码模式**：

```python
# PaddleOCR 基础用法（用于 ocr_service.py）
from paddleocr import PaddleOCR
import re

ocr = PaddleOCR(use_angle_cls=True, lang="ch")

def extract_amounts(image_path):
    """从截图中提取金额，返回结构化结果"""
    result = ocr.ocr(image_path, cls=True)
    extracted = []

    for line in result[0]:
        text = line[1][0]         # 识别的文字
        confidence = line[1][1]   # OCR 置信度
        bbox = line[0]            # 文字坐标框

        # 金额正则匹配
        amount_match = re.search(r'[¥￥]?\d+\.?\d{2}', text)
        if amount_match and confidence > 0.85:
            amount_str = amount_match.group()
            amount_str = amount_str.replace('¥', '').replace('￥', '')
            extracted.append({
                "amount": float(amount_str),
                "confidence": confidence,
                "bbox": bbox,
                "raw_text": text
            })
    return extracted

# 图像预处理（提升识别率）
from PIL import Image, ImageEnhance

def preprocess(image_path):
    img = Image.open(image_path).convert('RGB')
    # 增强对比度
    img = ImageEnhance.Contrast(img).enhance(1.5)
    # 增强锐度
    img = ImageEnhance.Sharpness(img).enhance(1.2)
    return img
```

### 参考价值总结

| 本项目模块 | 最佳参考 | 可借鉴内容 |
|-----------|---------|-----------|
| `excel_reader.py` | Cashbook | CSV 列头检测、元数据跳过、分类映射配置化 |
| `classifier.py` | Cashbook | categoryMap 字典 + 用户自定义 JSON 配置 |
| `excel_writer.py` | Perfect Books | 数据完整性校验、结构化写入 |
| `app.py` (Flask) | Budget Planner | 蓝图路由、错误处理中间件、API 封装模式 |
| 前端布局 | EasyAccounting | Ant Design 页面布局、Steps 流程、可编辑表格 |
| 前端 API 调用 | Budget Planner | React + Flask 的请求/响应模式 |
| `ocr_service.py` | 百度开发者文章 | PaddleOCR 基础用法 + 图像预处理 |

---

```bash
# 后端
cd backend
python app.py

# 前端
cd E:\tools\family-accounting\frontend
npm run dev
```
