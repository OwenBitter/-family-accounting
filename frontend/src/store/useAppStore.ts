import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Transaction, MonthlySummary, TrendDataPoint } from '../types';
import * as api from '../api';

interface AppState {
  currentMonth: string;
  setCurrentMonth: (month: string) => void;
  availableMonths: string[];
  fetchAvailableMonths: () => Promise<void>;

  importStep: number;
  importLoading: boolean;
  previewData: Transaction[];
  previewStatistics: {
    totalCount: number;
    expenseCount: number;
    incomeCount: number;
    totalExpense: number;
    totalIncome: number;
    unmappedCount: number;
  } | null;
  setImportStep: (step: number) => void;
  setImportLoading: (loading: boolean) => void;
  setPreviewData: (data: Transaction[], stats?: AppState['previewStatistics']) => void;

  summary: MonthlySummary | null;
  trendData: TrendDataPoint[];
  fetchSummary: (month: string) => Promise<void>;
  fetchTrend: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentMonth: '',
      setCurrentMonth: (month) => set({ currentMonth: month }),

      availableMonths: [],
      fetchAvailableMonths: async () => {
        try {
          const res = await api.fetchHistory();
          set({ availableMonths: res.availableMonths });
          if (!get().currentMonth && res.availableMonths.length > 0) {
            set({ currentMonth: res.availableMonths[res.availableMonths.length - 1] });
          }
        } catch {
          // silent
        }
      },

      importStep: 0,
      importLoading: false,
      previewData: [],
      previewStatistics: null,
      setImportStep: (step) => set({ importStep: step }),
      setImportLoading: (loading) => set({ importLoading: loading }),
      setPreviewData: (data, stats) =>
        set({ previewData: data, previewStatistics: stats ?? null }),

      summary: null,
      trendData: [],
      fetchSummary: async (month) => {
        try {
          const res = await api.fetchSummary(month);
          set({ summary: res.data });
        } catch {
          set({ summary: null });
        }
      },
      fetchTrend: async () => {
        try {
          const res = await api.fetchTrend();
          set({ trendData: res.data });
        } catch {
          set({ trendData: [] });
        }
      },
    }),
    {
      name: 'family-accounting-storage',
      partialize: (state) => ({
        currentMonth: state.currentMonth,
        availableMonths: state.availableMonths,
      }),
    }
  )
);
