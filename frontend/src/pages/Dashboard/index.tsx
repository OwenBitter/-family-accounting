import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Select, Empty, Spin, Table, Progress, Space, Button, Alert, Descriptions, Tag, Modal, Tooltip, message } from 'antd';
import {
  WalletOutlined, ArrowUpOutlined, ArrowDownOutlined, SaveOutlined, DownloadOutlined, EditOutlined, DollarOutlined,
} from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react';
import { useAppStore } from '../../store/useAppStore';
import * as api from '../../api';
import StatCard from '../../components/StatCard';
import AssetEditModal from '../../components/AssetEditModal';
import IncomeEditModal from '../../components/IncomeEditModal';
import { fmtNoDec, fmt, fmtMoney, fmtMoney2 } from '../../utils/format';
import type { CategoryAnalysis, Transaction, AssetData, IncomeRecord, GoldItem } from '../../types';

const mOpts = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}月` }));
const yOpts = Array.from({ length: 10 }, (_, i) => {
  const y = 2020 + i;
  return { value: String(y), label: `${y}年` };
});

export default function DashboardPage() {
  const currentMonth = useAppStore((s) => s.currentMonth);
  const setCurrentMonth = useAppStore((s) => s.setCurrentMonth);
  const availableMonths = useAppStore((s) => s.availableMonths);
  const summary = useAppStore((s) => s.summary);
  const trendData = useAppStore((s) => s.trendData);
  const fetchSummary = useAppStore((s) => s.fetchSummary);
  const fetchTrend = useAppStore((s) => s.fetchTrend);

  const [analysis, setAnalysis] = useState<CategoryAnalysis[]>([]);
  const [details, setDetails] = useState<Transaction[]>([]);
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([]);
  const [filteredAssets, setAssets] = useState<AssetData[]>([]);
  const [gold, setGold] = useState<GoldItem[]>([]);
  const [goldPrice, setGoldPrice] = useState(0);
  const [editAsset, setEditAsset] = useState<AssetData | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [incomeEditPerson, setIncomeEditPerson] = useState<'BB' | 'LN'>('BB');
  const [incomeEditOpen, setIncomeEditOpen] = useState(false);
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [prevMonthAssets, setPrevMonthAssets] = useState<Record<string, AssetData>>({});
  const [exportMonth, setExportMonth] = useState<string>('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const tooltipStyle = { backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#e8e2d6', textStyle: { color: '#794f27', fontSize: 12 } };

  // Compute previous month string from "2026.5" → "2026.4"
  const prevMonthStr = useMemo(() => {
    if (!currentMonth) return null;
    const [y, m] = currentMonth.split('.').map(Number);
    if (!y || !m) return null;
    if (m === 1) return `${y - 1}.12`;
    return `${y}.${m - 1}`;
  }, [currentMonth]);

  // Auto-select latest month if currentMonth is empty
  useEffect(() => {
    if (!currentMonth && availableMonths.length > 0) {
      setCurrentMonth(availableMonths[availableMonths.length - 1]);
    }
  }, [currentMonth, availableMonths, setCurrentMonth]);

  useEffect(() => {
    if (currentMonth) {
      setLoading(true);
      Promise.all([
        fetchSummary(currentMonth),
        api.fetchExpenses(currentMonth),
        api.fetchIncome(currentMonth),
        api.fetchAssets(currentMonth),
        prevMonthStr ? api.fetchAssets(prevMonthStr) : Promise.resolve(null),
      ]).then(([, exp, inc, ast, prevAst]) => {
        if (exp?.analysis) setAnalysis(exp.analysis);
        if (exp?.details) setDetails(exp.details);
        if (inc?.records) setIncomeRecords(inc.records);
        if (ast?.data) setAssets(ast.data);
        if (prevAst?.data) {
          const map: Record<string, AssetData> = {};
          prevAst.data.forEach((a: AssetData) => { map[a.person] = a; });
          setPrevMonthAssets(map);
        } else {
          setPrevMonthAssets({});
        }
      }).catch(() => {
        message.error('获取当月数据失败');
      }).finally(() => setLoading(false));
      fetchTrend();
    }
  }, [currentMonth, fetchSummary, fetchTrend, prevMonthStr]);

  useEffect(() => {
    Promise.all([
      api.fetchInvestments(),
      api.fetchGoldPrice(),
    ]).then(([inv, gp]) => {
      if (inv.gold) setGold(inv.gold);
      if (gp.pricePerGram) setGoldPrice(gp.pricePerGram);
    }).catch(() => {
      message.error('获取投资/金价数据失败');
    });
  }, []);

  const filteredDetails = useMemo(() => {
    if (personFilter === 'all') return details;
    return details.filter((d) => d.person === personFilter);
  }, [details, personFilter]);

  const filteredIncome = useMemo(() => {
    if (personFilter === 'all') return incomeRecords;
    return incomeRecords.filter((rec) => rec.person === personFilter);
  }, [incomeRecords, personFilter]);

  // 合并每人多条“余额宝”收益为一条，小额退款合并为“其他退款”
  const aggregatedIncome = useMemo(() => {
    if (!filteredIncome || !filteredIncome.length) return [] as IncomeRecord[];
    const yuebaoKey = (r: IncomeRecord) =>
      (r.category || '').includes('余额宝') ||
      (r.channel || '').includes('余额宝') ||
      (r.note || '').includes('余额宝');
    const MINOR_THRESHOLD = 10; // 小于此金额的零碎条目合并

    const yuebaoSums: Record<string, { amount: number; notes: string[]; channels: Set<string> }> = {};
    const minorRefunds: Record<string, { amount: number; count: number }> = {};
    const majorItems: IncomeRecord[] = [];

    filteredIncome.forEach((r) => {
      const amt = Number(r.amount || 0);
      if (yuebaoKey(r)) {
        const p = r.person;
        if (!yuebaoSums[p]) yuebaoSums[p] = { amount: 0, notes: [], channels: new Set() };
        yuebaoSums[p].amount += amt;
        if (r.note) yuebaoSums[p].notes.push(r.note);
        if (r.channel) yuebaoSums[p].channels.add(r.channel);
      } else if (r.category === '其他' || amt < MINOR_THRESHOLD) {
        // 其他类收入（含大额）和小额收入合并为"其他收入"
        if (!minorRefunds[r.person]) minorRefunds[r.person] = { amount: 0, count: 0 };
        minorRefunds[r.person].amount += amt;
        minorRefunds[r.person].count += 1;
      } else {
        majorItems.push(r);
      }
    });

    const result: IncomeRecord[] = [];

    // 余额宝聚合
    Object.keys(yuebaoSums).forEach((p) => {
      result.push({
        person: p as 'BB' | 'LN',
        time: '',
        category: '余额宝收益',
        amount: yuebaoSums[p].amount,
        channel: Array.from(yuebaoSums[p].channels).join(','),
        account: '',
        note: '',
      });
    });

    // 主要条目
    majorItems.forEach((r) => result.push(r));

    // 小额退款合并
    Object.keys(minorRefunds).forEach((p) => {
      const mr = minorRefunds[p];
      if (mr.count > 1 || mr.amount > 0) {
        result.push({
          person: p as 'BB' | 'LN',
          time: '',
          category: '其他收入',
          amount: mr.amount,
          channel: '',
          account: '',
          note: `共${mr.count}笔小额收入`,
        });
      }
    });

    return result;
  }, [filteredIncome]);

  const incomeTotal = useMemo(() => aggregatedIncome.reduce((sum, rec) => sum + Math.abs(rec.amount), 0), [aggregatedIncome]);

  // 收入明细数据 + 合计行（与支出明细样式一致）
  const incomeDataSource = useMemo(() => {
    const rows = aggregatedIncome.map((r, i) => ({ ...r, key: i }));
    rows.push({
      key: '__total__',
      person: '' as 'BB' | 'LN',
      time: '',
      category: '合计',
      amount: incomeTotal,
      channel: '',
      account: '',
      note: '',
      isTotal: true,
    });
    return rows;
  }, [aggregatedIncome, incomeTotal]);

  const filteredAnalysis = useMemo(() => {
    if (personFilter === 'all') {
      return [...analysis].sort((a, b) => b.totalAmount - a.totalAmount);
    }
    return analysis
      .map((c) => ({
        ...c,
        bbAmount: personFilter === 'BB' ? c.bbAmount : 0,
        lnAmount: personFilter === 'LN' ? c.lnAmount : 0,
        totalAmount: personFilter === 'BB' ? c.bbAmount : personFilter === 'LN' ? c.lnAmount : 0,
      }))
      .filter((c) => c.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [analysis, personFilter]);

  useEffect(() => {
    if (currentMonth) {
      setSelectedYear(currentMonth.split('.')[0]);
    }
  }, [currentMonth]);

  const yearOptions = useMemo(() => {
    const years = Array.from(new Set(trendData.map((d) => d.month.split('.')[0])));
    return years.sort();
  }, [trendData]);

  useEffect(() => {
    if (!selectedYear && yearOptions.length > 0) {
      setSelectedYear(yearOptions[yearOptions.length - 1]);
    }
  }, [selectedYear, yearOptions]);

  const yearTrendData = useMemo(() => {
    if (!selectedYear) return [];
    return trendData
      .filter((d) => d.month.startsWith(`${selectedYear}.`))
      .sort((a, b) => {
        const am = Number(a.month.split('.')[1] || 0);
        const bm = Number(b.month.split('.')[1] || 0);
        return am - bm;
      });
  }, [trendData, selectedYear]);

  const yearSummary = useMemo(() => {
    return yearTrendData.reduce((acc, cur) => {
      acc.income += cur.income;
      acc.expense += cur.expense;
      acc.saved += cur.saved;
      return acc;
    }, { income: 0, expense: 0, saved: 0 });
  }, [yearTrendData]);

  const annualOption = useMemo(() => {
    if (!yearTrendData.length) return null;
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', ...tooltipStyle,
        formatter: (params: any) => {
          const title = params[0]?.axisValue || '';
          return `<div style="font-weight:600;margin-bottom:4px">${title}</div>` +
            params.map((p: any) => `<div style="display:flex;justify-content:space-between;gap:16px"><span>${p.marker} ${p.seriesName}</span><b>¥${fmtNoDec(p.value)}</b></div>`).join('');
        },
      },
      legend: { data: ['收入', '支出', '本月攒'], textStyle: { color: '#9f927d' }, top: 0, itemWidth: 16, itemHeight: 8 },
      xAxis: { type: 'category' as const, data: yearTrendData.map((d) => `${d.month.split('.')[1]}月`), axisLine: { lineStyle: { color: '#d6c9b8' } }, axisLabel: { color: '#9f927d' } },
      yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#e8e2d6' } }, axisLabel: { color: '#9f927d', formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v) } },
      grid: { left: 50, right: 20, top: 40, bottom: 40 },
      series: [
        { name: '收入', type: 'bar', stack: 'total', itemStyle: { color: '#6fba2c' }, data: yearTrendData.map((d) => d.income) },
        { name: '支出', type: 'bar', stack: 'total', itemStyle: { color: '#e05a5a' }, data: yearTrendData.map((d) => d.expense) },
        { name: '本月攒', type: 'line', smooth: true, symbol: 'triangle', symbolSize: 6, lineStyle: { width: 2, type: 'dashed' as const }, itemStyle: { color: '#19c8b9' }, data: yearTrendData.map((d) => d.saved) },
      ],
    };
  }, [yearTrendData]);

  const handleExport = async () => {
    if (!exportMonth) return;
    setExportLoading(true);
    try {
      await api.exportMonth(exportMonth);
    } catch (err: any) {
      // message already handled by interceptor
    } finally {
      setExportLoading(false);
    }
  };


  // Diff indicator component
  function AssetDiff({ curr, prev }: { curr: number; prev?: number }) {
    if (prev === undefined) return null;
    const diff = curr - prev;
    if (Math.abs(diff) < 0.01) return <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>—</span>;
    const up = diff > 0;
    return (
      <span style={{ color: up ? '#ff4d4f' : '#52c41a', marginLeft: 8, fontSize: 12, whiteSpace: 'nowrap' }}>
        {up ? '↑' : '↓'} ¥{fmt(Math.abs(diff))}
        <span style={{ fontSize: 10, marginLeft: 2 }}>{up ? '涨' : '跌'}</span>
      </span>
    );
  }

  /* ── 趋势折线图 ── */
  const trendOption = useMemo(() => {
    if (!trendData.length) return null;
    const months = trendData.map((d) => d.month);
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', ...tooltipStyle,
        formatter: (params: any) => {
          const title = months[params[0]?.dataIndex] || '';
          return `<div style="font-weight:600;margin-bottom:4px">${title}</div>` +
            params.map((p: any) => `<div style="display:flex;justify-content:space-between;gap:20px"><span>${p.marker} ${p.seriesName}</span><b>¥${fmtNoDec(p.value)}</b></div>`).join('');
        },
      },
      legend: { data: ['收入', '支出', '本月攒'], textStyle: { color: '#9f927d' }, top: 0, itemWidth: 16, itemHeight: 8 },
      xAxis: { type: 'category' as const, data: months, axisLine: { lineStyle: { color: '#d6c9b8' } },
        axisLabel: { color: '#9f927d', rotate: months.length > 12 ? 45 : 0, fontSize: 10 } },
      yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#e8e2d6', type: 'dashed' as const } },
        axisLabel: { color: '#9f927d', formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v) } },
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      series: [
        { name: '收入', type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, lineStyle: { width: 2 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(111,186,44,0.25)' }, { offset: 1, color: 'rgba(111,186,44,0.02)' }] } },
          itemStyle: { color: '#6fba2c' }, data: trendData.map((d) => d.income) },
        { name: '支出', type: 'line', smooth: true, symbol: 'diamond', symbolSize: 5, lineStyle: { width: 2 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(224,90,90,0.25)' }, { offset: 1, color: 'rgba(224,90,90,0.02)' }] } },
          itemStyle: { color: '#e05a5a' }, data: trendData.map((d) => d.expense) },
        { name: '本月攒', type: 'line', smooth: true, symbol: 'triangle', symbolSize: 5, lineStyle: { width: 2, type: 'dashed' as const }, itemStyle: { color: '#19c8b9' }, data: trendData.map((d) => d.saved) },
      ],
    };
  }, [trendData]);

  /* ── 饼图 ── */
  const pieOption = useMemo(() => {
    const data = filteredAnalysis.filter((c) => c.totalAmount > 0).map((c) => ({ name: c.category, value: c.totalAmount }));
    if (!data.length) return null;
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' as const, ...tooltipStyle, formatter: (p: any) =>
        `<div style="font-weight:600;margin-bottom:4px">${p.name}</div>¥${fmtNoDec(p.value)} (${p.percent}%)` },
      legend: { type: 'scroll' as const, orient: 'vertical' as const, right: 10, textStyle: { color: '#9f927d', fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['42%', '68%'], center: ['32%', '50%'], avoidLabelOverlap: true,
        label: { show: true, position: 'outside', formatter: '{b}\n{d}%', color: '#9f927d', fontSize: 10, lineHeight: 14 },
        labelLine: { lineStyle: { color: '#d6c9b8' } },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(61,52,40,0.3)' } },
        color: ['#19c8b9','#6fba2c','#e87878','#889df0','#f5c31c','#e05a5a','#faad14','#a0d911','#eb2f96','#722ed1','#9f927d'],
        data,
      }],
    };
  }, [filteredAnalysis]);

  /* ── 对比柱状图 ── */
  const compareOption = useMemo(() => {
    const cats = filteredAnalysis.filter((c) => c.totalAmount > 0);
    if (!cats.length) return null;
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' as const, ...tooltipStyle,
        formatter: (params: any) => {
          const title = params[0]?.axisValue || '';
          return `<div style="font-weight:600;margin-bottom:4px">${title}</div>` +
            params.map((p: any) => `<div style="display:flex;justify-content:space-between;gap:16px"><span>${p.marker} ${p.seriesName}</span><b>¥${fmtNoDec(p.value)}</b></div>`).join('');
        },
      },
      legend: { data: personFilter === 'all' ? ['BB', 'LN'] : [personFilter], textStyle: { color: '#9f927d' }, top: 0, itemWidth: 16, itemHeight: 8 },
      xAxis: { type: 'category' as const, data: cats.map((c) => c.category),
        axisLabel: { color: '#9f927d', rotate: 30, fontSize: 10 }, axisLine: { lineStyle: { color: '#d6c9b8' } } },
      yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#e8e2d6' } },
        axisLabel: { color: '#9f927d', formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v) } },
      grid: { left: 50, right: 20, top: 30, bottom: 60 },
      series: personFilter === 'all' ? [
        { name: 'BB', type: 'bar', barWidth: '28%', barGap: '30%',
          itemStyle: { color: '#19c8b9', borderRadius: [4, 4, 0, 0] }, data: cats.map((c) => c.bbAmount) },
        { name: 'LN', type: 'bar', barWidth: '28%',
          itemStyle: { color: '#6fba2c', borderRadius: [4, 4, 0, 0] }, data: cats.map((c) => c.lnAmount) },
      ] : [
        { name: personFilter, type: 'bar', barWidth: '40%',
          itemStyle: { color: personFilter === 'BB' ? '#19c8b9' : '#6fba2c', borderRadius: [4, 4, 0, 0] }, data: cats.map((c) => c.totalAmount) },
      ],
    };
  }, [filteredAnalysis]);

  /* ── 资产堆叠图 ── */
  const assetStackOption = useMemo(() => {
    const displayAssets = personFilter === 'all' ? filteredAssets : filteredAssets.filter((a) => a.person === personFilter);
    if (!displayAssets.length) return null;
    const persons = displayAssets.map((a) => a.person);
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' as const, ...tooltipStyle },
      legend: { data: ['余额宝', '基金', '余额/零钱', '零钱通', '银行卡'], textStyle: { color: '#9f927d' }, top: 0, itemWidth: 16, itemHeight: 8 },
      xAxis: { type: 'category' as const, data: persons, axisLabel: { color: '#794f27', fontSize: 13, fontWeight: 'bold' as any }, axisLine: { lineStyle: { color: '#d6c9b8' } } },
      yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#e8e2d6' } }, axisLabel: { color: '#9f927d', formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v) } },
      grid: { left: 50, right: 20, top: 30, bottom: 30 },
      series: [
        { name: '余额宝', type: 'bar', stack: 'total', barWidth: 40, itemStyle: { color: '#19c8b9' }, data: displayAssets.map((a) => a.alipayYuebao) },
        { name: '基金', type: 'bar', stack: 'total', itemStyle: { color: '#722ed1' }, data: displayAssets.map((a) => a.alipayFund) },
        { name: '余额/零钱', type: 'bar', stack: 'total', itemStyle: { color: '#13c2c2' }, data: displayAssets.map((a) => a.alipayBalance + a.wechatBalance) },
        { name: '零钱通', type: 'bar', stack: 'total', itemStyle: { color: '#52c41a' }, data: displayAssets.map((a) => a.wechatLicaitong) },
        { name: '银行卡', type: 'bar', stack: 'total', itemStyle: { color: '#faad14' }, data: displayAssets.map((a) => Object.entries(a.bankAccounts).filter(([k]) => k !== '总额').reduce((s, [, v]) => s + v, 0)) },
      ],
    };
  }, [filteredAssets, personFilter]);

  // Compute filtered summary stats based on person filter
  const filteredSummary = useMemo(() => {
    if (!summary) return null;
    if (personFilter === 'BB') {
      return {
        income: summary.bb.income,
        expense: summary.bb.expense,
        saved: summary.bb.saved,
        grandTotal: summary.bb.total,
        lastBalance: summary.bb.lastBalance,
        externalAsset: summary.total.externalAsset,
        otherAsset: summary.total.otherAsset,
      };
    }
    if (personFilter === 'LN') {
      return {
        income: summary.ln.income,
        expense: summary.ln.expense,
        saved: summary.ln.saved,
        grandTotal: summary.ln.total,
        lastBalance: summary.ln.lastBalance,
        externalAsset: summary.total.externalAsset,
        otherAsset: summary.total.otherAsset,
      };
    }
    return {
      income: summary.total.income,
      expense: summary.total.expense,
      saved: summary.total.saved,
      grandTotal: summary.total.grandTotal,
      lastBalance: summary.bb.lastBalance + summary.ln.lastBalance,
      externalAsset: summary.total.externalAsset,
      otherAsset: summary.total.otherAsset,
    };
  }, [summary, personFilter]);

  const totalExpense = filteredAnalysis.reduce((s, c) => s + c.totalAmount, 0);
  const bbTotal = filteredAnalysis.reduce((s, c) => s + c.bbAmount, 0);
  const lnTotal = filteredAnalysis.reduce((s, c) => s + c.lnAmount, 0);

  const dashboardDataSource = useMemo(() => {
    const rows: any[] = filteredAnalysis.map((c, i) => ({ ...c, key: i }));
    rows.push({
      key: '__total__',
      category: '合计',
      bbAmount: bbTotal,
      lnAmount: lnTotal,
      totalAmount: totalExpense,
      isTotal: true,
    });
    return rows;
  }, [filteredAnalysis, bbTotal, lnTotal, totalExpense]);

  const tableColumns = useMemo(() => {
    const cellStyle: React.CSSProperties = { verticalAlign: 'top' };
    const cols: any[] = [
      { title: '分类', dataIndex: 'category', key: 'category',
        sorter: (a: any, b: any) => a.category.localeCompare(b.category),
        onCell: () => ({ style: { fontWeight: 500, ...cellStyle } }),
        render: (v: string, record: any) => record.isTotal ? <strong>合计</strong> : v,
      },
    ];
    if (personFilter === 'all') {
      cols.push(
        { title: <><span style={{ color: '#19c8b9', marginRight: 4 }}>●</span><b>斌</b>的支出</>, dataIndex: 'bbAmount', key: 'bbAmount',
          sorter: (a: any, b: any) => a.bbAmount - b.bbAmount,
          render: (v: number, record: any) => record.isTotal
            ? <><span style={{ color: '#19c8b9', fontSize: 12, marginRight: 2 }}>●</span><strong style={{ color: '#19c8b9', fontSize: 15 }}>{fmtMoney2(v)}</strong></>
            : <span style={{ color: '#1a1a1a' }}>{fmtMoney2(v)}</span>,
          onCell: (record: any) => record.isTotal ? {} : ({ style: { backgroundColor: '#f0faf8', ...cellStyle } }),
        },
        { title: <><span style={{ color: '#6fba2c', marginRight: 4 }}>●</span><b>纳</b>的支出</>, dataIndex: 'lnAmount', key: 'lnAmount',
          sorter: (a: any, b: any) => a.lnAmount - b.lnAmount,
          render: (v: number, record: any) => record.isTotal
            ? <><span style={{ color: '#6fba2c', fontSize: 12, marginRight: 2 }}>●</span><strong style={{ color: '#6fba2c', fontSize: 15 }}>{fmtMoney2(v)}</strong></>
            : <span style={{ color: '#1a1a1a' }}>{fmtMoney2(v)}</span>,
          onCell: (record: any) => record.isTotal ? {} : ({ style: { backgroundColor: '#f4faf0', ...cellStyle } }),
        },
        { title: <b>合计</b>, dataIndex: 'totalAmount', key: 'totalAmount',
          sorter: (a: any, b: any) => a.totalAmount - b.totalAmount,
          render: (v: number, record: any) => record.isTotal
            ? <strong style={{ color: '#1677ff', fontSize: 15 }}>{fmtMoney2(v)}</strong>
            : <b style={{ color: '#1677ff' }}>{fmtMoney2(v)}</b>,
          onCell: () => ({ style: { ...cellStyle } }),
        },
      );
    } else {
      cols.push(
        { title: <b>支出</b>, dataIndex: 'totalAmount', key: 'totalAmount',
          sorter: (a: any, b: any) => a.totalAmount - b.totalAmount,
          render: (v: number, record: any) => record.isTotal
            ? <strong style={{ color: '#1677ff', fontSize: 15 }}>{fmtMoney2(v)}</strong>
            : <b>{fmtMoney2(v)}</b>,
          onCell: () => ({ style: { ...cellStyle } }),
        },
      );
    }
    cols.push({
      title: <span style={{ color: '#666' }}>占总支出比</span>, key: 'ratio', width: 150,
      sorter: (a: any, b: any) => a.totalAmount - b.totalAmount,
      render: (_: any, record: any) => record.isTotal ? null : (
        <Progress percent={totalExpense > 0 ? Number((record.totalAmount / totalExpense * 100).toFixed(1)) : 0}
          size="small" format={(pct) => `${pct}%`} strokeColor="#888" style={{ margin: 0 }} />
      ),
    });
    return cols;
  }, [personFilter, totalExpense]);

  return (
    <div>
      <Row justify="space-between" align="middle" className="page-header">
        <Col>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#4b3b2e' }}>总览</div>
            <div style={{ color: '#7f6b57', fontSize: 14 }}>更清晰的资产与收支洞察</div>
          </div>
        </Col>
        <Col>
          <Space wrap>
            <Select value={personFilter} onChange={setPersonFilter}
              options={[{ value: 'all', label: '全部' }, { value: 'BB', label: '斌' }, { value: 'LN', label: '纳' }]}
              style={{ width: 90 }} />
            <Select value={currentMonth?.split('.')[0] || undefined}
              onChange={(y) => setCurrentMonth(y ? `${y}.${currentMonth?.split('.')[1] || '1'}` : '')}
              options={yOpts} placeholder="年" style={{ width: 90 }} allowClear />
            <span style={{ color: '#a0a0a0', margin: '0 2px' }}>年</span>
            <Select value={currentMonth?.split('.')[1] || undefined}
              onChange={(m) => setCurrentMonth(m ? `${currentMonth?.split('.')[0] || '2026'}.${m}` : '')}
              options={mOpts} placeholder="月" style={{ width: 80 }} allowClear />
            <span style={{ color: '#a0a0a0', margin: '0 2px' }}>月</span>
            <Button type="default" icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>导出</Button>
          </Space>
        </Col>
      </Row>

      {!availableMonths.length ? (
        <Empty description="暂无数据，请先导入支出或识别收入" />
      ) : loading ? (
        <Spin><div style={{ height: 300 }} /></Spin>
      ) : !summary ? (
        <Empty description={`${currentMonth} 暂无数据`} />
      ) : (
        <>
          {/* 统计卡片 */}
          <Row gutter={[8, 8]}>
            <Col xs={12} sm={3}><StatCard title="总资产" value={filteredSummary!.grandTotal} precision={0} prefix={<WalletOutlined />} color="#1677ff" /></Col>
            <Col xs={12} sm={3}><StatCard title="收入" value={filteredSummary!.income} precision={0} prefix={<ArrowUpOutlined />} color="#52c41a" /></Col>
            <Col xs={12} sm={3}><StatCard title="支出" value={filteredSummary!.expense} precision={0} prefix={<ArrowDownOutlined />} color="#ff4d4f" /></Col>
            <Col xs={12} sm={3}>
              {(() => {
                const diff = Math.abs((filteredSummary!.income - filteredSummary!.expense) - filteredSummary!.saved);
                const warning = diff > 1000 ? `收入-支出 与 本月攒 的差额为 ${fmtMoney(diff)}，差值偏大，请检查资产或收入/支出数据` : undefined;
                return <StatCard title="本月攒" value={filteredSummary!.saved} precision={0} prefix={<SaveOutlined />} color="#ffd700" warning={warning} />;
              })()}
            </Col>
            <Col xs={12} sm={3}><StatCard title="余额" value={filteredSummary!.lastBalance} precision={0} color="#a0a0a0" /></Col>
            <Col xs={12} sm={3}><StatCard title="外借" value={filteredSummary!.externalAsset} precision={0} prefix={<WalletOutlined />} color="#ff8800" /></Col>
            <Col xs={12} sm={3}>
              <div style={{ cursor: 'pointer' }} onClick={() => window.location.hash = '#/investment'}>
                <StatCard title="黄金价值" value={gold.reduce((s, g) => s + g.weight, 0) * goldPrice} precision={0} prefix={<WalletOutlined />} color="#ffd700" />
              </div>
            </Col>
          </Row>

          {yearOptions.length > 0 && (
            <Card className="chart-card card-group" title={`全年看板 ${selectedYear}`} style={{ marginTop: 16 }}>
              <Row gutter={[20, 20]} align="middle">
                <Col xs={24} md={8}>
                  <Card type="inner" title="年度概览" styles={{ body: { padding: 18 } }} style={{ borderRadius: 18, borderColor: '#f0e8d8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 100 }}>
                        <div style={{ color: '#9f927d', fontSize: 12 }}>收入</div>
                        <div style={{ color: '#2e7d32', fontSize: 18, fontWeight: 700 }}>{fmtMoney(yearSummary.income)}</div>
                      </div>
                      <div style={{ minWidth: 100 }}>
                        <div style={{ color: '#9f927d', fontSize: 12 }}>支出</div>
                        <div style={{ color: '#c41d7f', fontSize: 18, fontWeight: 700 }}>{fmtMoney(yearSummary.expense)}</div>
                      </div>
                      <div style={{ minWidth: 100 }}>
                        <div style={{ color: '#9f927d', fontSize: 12 }}>攒</div>
                        <div style={{ color: '#1677ff', fontSize: 18, fontWeight: 700 }}>{fmtMoney(yearSummary.saved)}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <Space>
                        <span>年度</span>
                        <Select value={selectedYear} onChange={setSelectedYear}
                          options={yearOptions.map((y) => ({ value: y, label: `${y}年` }))}
                          style={{ width: 120 }} />
                      </Space>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={16}>
                  <Card type="inner" styles={{ body: { padding: 14 } }} style={{ borderRadius: 18, borderColor: '#f0e8d8' }}>
                    {annualOption ? (
                      <ReactEChartsCore option={annualOption} style={{ height: 320 }} />
                    ) : (
                      <Empty description="暂无当年数据" style={{ marginTop: 16 }} />
                    )}
                  </Card>
                </Col>
              </Row>
            </Card>
          )}

          {/* 资产详情 + 图表（并列）*/}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
            <Col xs={24} lg={16}>
              <Card className="chart-card" title="资产构成" styles={{ body: { padding: 22 } }} style={{ height: '100%' }}>
                {personFilter === 'all' && (summary.total.externalAsset > 0 || summary.total.otherAsset > 0) && (
                  <Alert type="info" showIcon style={{ marginBottom: 18, borderRadius: 14, background: '#f3faf7', borderColor: '#d6f5e6' }}
                    message={`外借资产 ${fmtMoney(summary.total.externalAsset)}　其他资产 ${fmtMoney(summary.total.otherAsset)}　合计 ${fmtMoney(summary.total.externalAsset + summary.total.otherAsset)}`} />
                )}
                <Row gutter={[18, 18]}>
                  {filteredAssets.filter((a) => personFilter === 'all' || a.person === personFilter).map((a) => (
                    <Col xs={24} md={12} key={a.person}>
                      <Card type="inner" styles={{ body: { padding: 18 } }} style={{ borderRadius: 18, borderColor: '#f0e8d8' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                          <Space>
                            <Tag color={a.person === 'BB' ? 'blue' : 'green'}>{a.person === 'BB' ? '斌' : '纳'}的资产</Tag>
                            <Tooltip title="编辑资产">
                              <Button type="text" size="small" icon={<EditOutlined />}
                                onClick={() => { setEditAsset(a); setEditModalOpen(true); }} />
                            </Tooltip>
                            <Tooltip title="编辑收入">
                              <Button type="text" size="small" icon={<DollarOutlined />}
                                onClick={() => { setIncomeEditPerson(a.person); setIncomeEditOpen(true); }} />
                            </Tooltip>
                          </Space>
                          <div style={{ color: '#1677ff', fontWeight: 700, fontSize: 16 }}>{fmtMoney(a.total || 0)}</div>
                        </div>
                        <Descriptions
                          column={1} size="small"
                          styles={{ label: { color: '#7f6b57', fontSize: 13 }, content: { color: '#4b3b2e', fontSize: 13 } }}
                        >
                          <Descriptions.Item label="基金">
                            {fmtMoney(a.alipayFund || 0)}
                            <AssetDiff curr={a.alipayFund || 0} prev={prevMonthAssets[a.person]?.alipayFund} />
                          </Descriptions.Item>
                          <Descriptions.Item label="余额宝">
                            {fmtMoney(a.alipayYuebao || 0)}
                            <AssetDiff curr={a.alipayYuebao || 0} prev={prevMonthAssets[a.person]?.alipayYuebao} />
                          </Descriptions.Item>
                          <Descriptions.Item label="余额/零钱">
                            {fmtMoney((a.alipayBalance || 0) + (a.wechatBalance || 0))}
                            <AssetDiff curr={(a.alipayBalance || 0) + (a.wechatBalance || 0)} prev={(prevMonthAssets[a.person]?.alipayBalance || 0) + (prevMonthAssets[a.person]?.wechatBalance || 0)} />
                          </Descriptions.Item>
                          <Descriptions.Item label="零钱通">
                            {fmtMoney(a.wechatLicaitong || 0)}
                            <AssetDiff curr={a.wechatLicaitong || 0} prev={prevMonthAssets[a.person]?.wechatLicaitong} />
                          </Descriptions.Item>
                          {Object.entries(a.bankAccounts || {})
                            .filter(([k]) => k !== '总额')
                            .map(([bank, amt]) => (
                              <Descriptions.Item label={bank} key={bank}>
                                {fmtMoney(amt || 0)}
                                <AssetDiff curr={amt || 0} prev={prevMonthAssets[a.person]?.bankAccounts?.[bank]} />
                              </Descriptions.Item>
                            ))}
                          {Object.entries(a.other || {}).map(([name, amt]) => (
                            <Descriptions.Item label={name} key={name}>
                              {fmtMoney(amt || 0)}
                              <AssetDiff curr={amt || 0} prev={prevMonthAssets[a.person]?.other?.[name]} />
                            </Descriptions.Item>
                          ))}
                          <Descriptions.Item label={<strong>合计</strong>}>
                            <strong style={{ color: '#1677ff' }}>{fmtMoney(a.total || 0)}</strong>
                            <AssetDiff curr={a.total || 0} prev={prevMonthAssets[a.person]?.total} />
                          </Descriptions.Item>
                        </Descriptions>
                      </Card>
                    </Col>
                  ))}
                </Row>
                {assetStackOption && (
                  <div style={{ marginTop: 22 }}>
                    <ReactEChartsCore option={assetStackOption} style={{ height: 200 }} />
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {pieOption && (
                  <Card className="chart-card" title="支出分类" size="small" styles={{ body: { padding: 12 } }}>
                    <ReactEChartsCore option={pieOption} style={{ height: 260 }} />
                  </Card>
                )}
                {compareOption && (
                  <Card className="chart-card" title="对比" size="small" styles={{ body: { padding: 12 } }}>
                    <ReactEChartsCore option={compareOption} style={{ height: 260 }} />
                  </Card>
                )}
              </Space>
            </Col>
          </Row>

          {/* 支出明细 + 收入明细（同行等高等宽） */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <Card className="chart-card" title="支出明细" styles={{ body: { padding: 20, maxHeight: 680, overflowY: 'auto' } }}>
                <Table
                  dataSource={dashboardDataSource}
                  columns={tableColumns} pagination={false} size="small"
                  rowClassName={(record: any) => record.isTotal ? 'total-row' : ''}
                  onRow={(record: any) => record.isTotal ? { style: { backgroundColor: '#f8f9fb', borderTop: '2px solid #e8e2d6' } } : {}}
                  expandable={filteredDetails.length > 0 ? {
                    rowExpandable: (record: any) => !record.isTotal,
                    expandedRowRender: (record: any) => {
                      const txns = filteredDetails.filter((t) => (t.liveCategory || t.targetCategory || t.rawCategory) === record.category);
                      return (
                        <div style={{ maxHeight: 260, overflowY: 'auto', overflowX: 'hidden' }}>
                          <Table dataSource={txns.map((t, i) => ({ ...t, key: i }))}
                            columns={[
                              { title: '时间', dataIndex: 'time', sorter: (a: any, b: any) => (a.time || '').localeCompare(b.time || ''), render: (v: string) => v?.slice(0, 16) },
                              { title: '人员', dataIndex: 'person', width: 60, sorter: (a: any, b: any) => a.person.localeCompare(b.person) },
                              { title: '金额', dataIndex: 'amount', sorter: (a: any, b: any) => Math.abs(a.amount) - Math.abs(b.amount), render: (v: number) => `¥${Math.abs(v).toFixed(2)}`, width: 100 },
                              { title: '描述', dataIndex: 'description', sorter: (a: any, b: any) => (a.description || '').localeCompare(b.description || '') },
                            ]}
                            pagination={false} size="small" />
                        </div>
                      );
                    },
                  } : undefined}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card className="chart-card" title="收入明细" styles={{ body: { padding: 20, maxHeight: 680, overflowY: 'auto' } }}>
                <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 600, color: '#4b3b2e' }}>本月收入合计</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}>{fmtMoney(incomeTotal)}</span>
                </div>
                <Table
                  dataSource={incomeDataSource}
                  columns={[
                    { title: '类型', dataIndex: 'category',
                      sorter: (a: any, b: any) => {
                        if (a.isTotal) return 1; if (b.isTotal) return -1;
                        return a.category.localeCompare(b.category);
                      },
                      render: (v: string, r: any) => r.isTotal
                        ? <span style={{ fontWeight: 700, fontSize: 14 }}>合计</span>
                        : r.category === '余额宝收益' || r.category === '其他收入'
                          ? <Tag color={r.category === '余额宝收益' ? 'blue' : 'default'}>{v}</Tag>
                          : <span style={{ fontWeight: 500 }}>{v}</span>,
                    },
                    { title: '人员', dataIndex: 'person', width: 60,
                      sorter: (a: any, b: any) => a.person.localeCompare(b.person),
                      render: (v: string) => v === 'BB' ? '斌' : v === 'LN' ? '纳' : '',
                    },
                    { title: '收入', dataIndex: 'amount',
                      sorter: (a: any, b: any) => a.amount - b.amount,
                      render: (v: number, r: any) => {
                        if (r.isTotal) return <strong style={{ color: '#1677ff', fontSize: 15 }}>¥{v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>;
                        const isAgg = r.category === '余额宝收益' || r.category === '其他收入';
                        return <span style={{ fontWeight: isAgg ? 600 : 400, color: isAgg ? '#1677ff' : '#333' }}>¥{v.toFixed(2)}</span>;
                      },
                    },
                    { title: '时间', dataIndex: 'time',
                      sorter: (a: any, b: any) => (a.time || '').localeCompare(b.time || ''),
                      render: (v: string) => v?.slice(0, 10),
                    },
                    { title: '备注', dataIndex: 'note', ellipsis: true,
                      render: (v: string, r: any) =>
                        r.isTotal ? null
                        : r.category === '余额宝收益' || r.category === '其他收入'
                          ? <span style={{ color: '#999', fontSize: 12 }}>{v || (r.category === '余额宝收益' ? '月度汇总' : '小额收入汇总')}</span>
                          : v,
                    },
                  ]}
                  pagination={false}
                  size="small"
                  locale={{ emptyText: '暂无收入记录' }}
                  rowClassName={(record: any) => record.isTotal ? 'total-row' : ''}
                  onRow={(record: any) => record.isTotal ? { style: { backgroundColor: '#f8f9fb', borderTop: '2px solid #e8e2d6' } } : {}}
                  expandable={{
                    rowExpandable: (record: any) => !record.isTotal && (
                      record.category === '余额宝收益' || record.category === '其他收入' || filteredIncome.filter((r) => r.category === record.category && r.person === record.person).length > 1
                    ),
                    expandedRowRender: (record: IncomeRecord) => {
                      let items = filteredIncome.filter((r) => {
                        const catMatch = r.category === record.category;
                        const personMatch = r.person === record.person;
                        return catMatch && personMatch;
                      });
                      // 如果是聚合类（余额宝/其他收入）,用原始明细
                      if (record.category === '余额宝收益' || record.category === '其他收入') {
                        items = filteredIncome.filter((r) => {
                          const isYuebao = (r.category || '').includes('余额宝') || (r.channel || '').includes('余额宝');
                          if (record.category === '余额宝收益') return isYuebao && r.person === record.person;
                          const isMinor = Math.abs(r.amount) < 10 && !isYuebao;
                          return isMinor && r.person === record.person;
                        });
                      }
                      return (
                        <div style={{ maxHeight: 300, overflowY: 'auto', overflowX: 'hidden' }}>
                          <Table
                            dataSource={items.map((t, i) => ({ ...t, key: i }))}
                            columns={[
                              { title: '时间', dataIndex: 'time', sorter: (a: any, b: any) => (a.time || '').localeCompare(b.time || ''), render: (v: string) => v?.slice(0, 16) },
                              { title: '人员', dataIndex: 'person', width: 60, sorter: (a: any, b: any) => a.person.localeCompare(b.person), render: (v: string) => v === 'BB' ? '斌' : '纳' },
                              { title: '金额', dataIndex: 'amount', sorter: (a: any, b: any) => a.amount - b.amount, render: (v: number) => `¥${v.toFixed(2)}`, width: 100 },
                              { title: '渠道', dataIndex: 'channel', width: 80 },
                              { title: '备注', dataIndex: 'note', ellipsis: true },
                            ]}
                            pagination={false} size="small"
                          />
                        </div>
                      );
                    },
                  }}
                />
              </Card>
            </Col>
          </Row>

          {/* 趋势图 */}
          {trendOption && (
            <Card className="chart-card" title="收支趋势" size="small" style={{ marginTop: 16 }}>
              <ReactEChartsCore option={trendOption} style={{ height: 260 }} />
            </Card>
          )}

          {/* 饼图 + 对比柱状图 */}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12}>
              {pieOption && (
                <Card className="chart-card" title="支出分类" size="small">
                  <ReactEChartsCore option={pieOption} style={{ height: 300 }} />
                </Card>
              )}
            </Col>
            <Col xs={24} md={12}>
              {compareOption && (
                <Card className="chart-card" title="对比" size="small">
                  <ReactEChartsCore option={compareOption} style={{ height: 300 }} />
                </Card>
              )}
            </Col>
          </Row>

          {/* 导出 */}
          <Modal title="导出 Excel" open={exportOpen} onCancel={() => setExportOpen(false)}
            footer={[
              <Button key="cancel" onClick={() => setExportOpen(false)}>取消</Button>,
              <Button key="download" type="primary" icon={<DownloadOutlined />} loading={exportLoading}
                disabled={!exportMonth} onClick={() => { handleExport(); setExportOpen(false); }}>
                下载
              </Button>,
            ]}>
            <Space direction="vertical" size="middle" style={{ width: '100%', paddingTop: 16 }}>
              <Space>
                <Select value={exportMonth?.split('.')[0] || undefined}
                  onChange={(y) => setExportMonth(y ? `${y}.${exportMonth?.split('.')[1] || '1'}` : '')}
                  options={yOpts} placeholder="年" style={{ width: 110 }} allowClear />
                <span style={{ color: '#a0a0a0' }}>年</span>
                <Select value={exportMonth?.split('.')[1] || undefined}
                  onChange={(m) => setExportMonth(m ? `${exportMonth?.split('.')[0] || '2026'}.${m}` : '')}
                  options={mOpts} placeholder="月" style={{ width: 100 }} allowClear />
                <span style={{ color: '#a0a0a0' }}>月</span>
              </Space>
              {exportMonth && <Alert type="info" showIcon message={`导出 ${exportMonth} 的记账文件`} />}
            </Space>
          </Modal>

          <AssetEditModal
            open={editModalOpen}
            asset={editAsset}
            month={currentMonth}
            onClose={() => { setEditModalOpen(false); setEditAsset(null); }}
            onSaved={() => {
              setEditModalOpen(false);
              setEditAsset(null);
              if (currentMonth) {
                api.fetchAssets(currentMonth).then((ast) => {
                  if (ast?.data) setAssets(ast.data);
                });
                fetchSummary(currentMonth);
              }
            }}
          />
          <IncomeEditModal
            open={incomeEditOpen}
            month={currentMonth}
            person={incomeEditPerson}
            onClose={() => { setIncomeEditOpen(false); }}
            onSaved={() => {
              setIncomeEditOpen(false);
              if (currentMonth) fetchSummary(currentMonth);
            }}
          />
        </>
      )}
    </div>
  );
}
