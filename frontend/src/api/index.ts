import axios from 'axios';
import type {
  Transaction,
  MonthlySummary,
  CategoryAnalysis,
  AssetData,
  OcrResult,
  TrendDataPoint,
} from '../types';

function toCamelCase(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
        toCamelCase(v),
      ])
    );
  }
  return obj;
}

function toSnakeCase(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
        toSnakeCase(v),
      ])
    );
  }
  return obj;
}

const http = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

http.interceptors.request.use(
  (config) => {
    if (config.data && !(config.data instanceof FormData)) {
      config.data = toSnakeCase(config.data) as any;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

http.interceptors.response.use(
  (res) => toCamelCase(res.data) as any,
  (err) => {
    const msg = err.response?.data?.error?.message || err.message || '网络错误';
    return Promise.reject(new Error(msg));
  }
);

export async function fetchHealth(): Promise<{ status: string }> {
  return http.get('/health');
}

export async function importPreview(
  person: string,
  month: string,
  files: File[],
  autoDetect = true
): Promise<{
  success: boolean;
  transactions: Transaction[];
  statistics: {
    totalCount: number;
    expenseCount: number;
    incomeCount: number;
    totalExpense: number;
    totalIncome: number;
    unmappedCount: number;
  };
  duplicateOrderIds: string[];
  personWarnings: { file: string; detectedPerson: string }[];
}> {
  const form = new FormData();
  form.append('person', person);
  form.append('month', month);
  form.append('auto_detect', String(autoDetect));
  files.forEach((f) => form.append('files', f));
  return http.post('/import/preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function importConfirm(
  person: string,
  month: string,
  transactions: Transaction[]
): Promise<{ success: boolean; filePath: string; addedCount: number }> {
  return http.post('/import/confirm', { person, month, transactions });
}

export async function ocrUpload(
  person: string,
  images: File[]
): Promise<{ success: boolean; results: OcrResult[] }> {
  const form = new FormData();
  form.append('person', person);
  images.forEach((img) => form.append('images', img));
  return http.post('/ocr/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function ocrConfirm(
  month: string,
  person: string,
  data: Record<string, unknown>,
  incomeRecords?: Record<string, unknown>[]
): Promise<{ success: boolean; filePath: string }> {
  return http.post('/ocr/confirm', { month, person, data, income_records: incomeRecords });
}

export async function fetchSummary(month: string): Promise<{ success: boolean; data: MonthlySummary | null }> {
  return http.get('/data/summary', { params: { month } });
}

export async function fetchExpenses(month: string): Promise<{
  success: boolean;
  details: Transaction[];
  analysis: CategoryAnalysis[];
}> {
  return http.get('/data/expenses', { params: { month } });
}

export async function fetchAssets(month: string): Promise<{ success: boolean; data: AssetData[] }> {
  return http.get('/data/assets', { params: { month } });
}

export async function fetchInvestments(): Promise<{
  success: boolean; loanBook: import('../types').LoanRecord[]; gold: import('../types').GoldItem[];
}> {
  return http.get('/data/investments');
}

export async function fetchGoldPrice(): Promise<{ success: boolean; pricePerGram: number }> {
  return http.get('/data/gold-price');
}

export async function fetchIncome(month: string): Promise<{ success: boolean; records: Transaction[] }> {
  return http.get('/data/income', { params: { month } });
}

export async function fetchHistory(): Promise<{ success: boolean; availableMonths: string[] }> {
  return http.get('/data/history');
}

export async function fetchTrend(): Promise<{ success: boolean; data: TrendDataPoint[] }> {
  return http.get('/data/trend');
}

export async function fetchCategories(): Promise<{
  success: boolean;
  categories: string[];
  mappings: Record<string, unknown>;
}> {
  return http.get('/categories');
}

export async function exportMonth(month: string): Promise<void> {
  const url = `/api/export?month=${month}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `家庭收支${month}.xlsx`;
  a.click();
}
