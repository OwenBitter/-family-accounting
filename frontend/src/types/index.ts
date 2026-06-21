export interface Transaction {
  person: 'BB' | 'LN';
  source: 'alipay' | 'wechat' | 'xlsx' | 'manual';
  time: string;
  rawCategory: string;
  targetCategory: string;
  /** 实时分类（由后端当前分类规则决定，与 analysis 一致） */
  liveCategory?: string;
  amount: number;
  paymentMethod: string;
  description: string;
  counterparty: string;
  status: string;
  orderId?: string;
  detectedPerson?: string | null;
  personConfidence?: string;
}

export interface MonthlySummary {
  month: string;
  bb: {
    lastBalance: number;
    income: number;
    expense: number;
    saved: number;
    total: number;
  };
  ln: {
    lastBalance: number;
    income: number;
    expense: number;
    saved: number;
    total: number;
  };
  total: {
    income: number;
    expense: number;
    saved: number;
    grandTotal: number;
    externalAsset: number;
    otherAsset: number;
  };
}

export interface CategoryAnalysis {
  category: string;
  bbAmount: number;
  lnAmount: number;
  totalAmount: number;
}

export interface IncomeRecord {
  person: 'BB' | 'LN';
  time: string;
  category: string;
  amount: number;
  channel: string;
  account: string;
  note: string;
}

export interface AssetData {
  person: 'BB' | 'LN';
  alipayFund: number;
  alipayYuebao: number;
  alipayBalance: number;
  wechatBalance: number;
  wechatLicaitong: number;
  bankAccounts: Record<string, number>;
  other: Record<string, number>;
  total: number;
}

export interface TrendDataPoint {
  month: string;
  income: number;
  expense: number;
  saved: number;
}

export interface LoanRecord {
  month: string;
  person: string;
  amount: number;
  note: string;
  totalInCard: number | null;
}

export interface GoldItem {
  name: string;
  weight: number;
  source: string;
  imageIndex: number;
}

export interface PreviewStatistics {
  totalCount: number;
  expenseCount: number;
  incomeCount: number;
  totalExpense: number;
  totalIncome: number;
  unmappedCount: number;
}
