import { useEffect, useMemo, useState } from 'react';
import { Card, Select, Space, Table, Empty, Spin, Progress, Row, Col } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react';
import { useAppStore } from '../../store/useAppStore';
import * as api from '../../api';
import StatCard from '../../components/StatCard';
import type { CategoryAnalysis, IncomeRecord, Transaction } from '../../types';

export default function AnalysisPage() {
  const currentMonth = useAppStore((s) => s.currentMonth);
  const setCurrentMonth = useAppStore((s) => s.setCurrentMonth);
  const availableMonths = useAppStore((s) => s.availableMonths);

  const [analysis, setAnalysis] = useState<CategoryAnalysis[]>([]);
  const [details, setDetails] = useState<Transaction[]>([]);
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [personFilter, setPersonFilter] = useState<string>('all');

  useEffect(() => {
    if (!currentMonth) return;
    setLoading(true);
    Promise.all([
      api.fetchExpenses(currentMonth),
      api.fetchIncome(currentMonth),
    ]).then(([exp, inc]) => {
      setAnalysis(exp.analysis);
      setDetails(exp.details);
      setIncomeRecords(inc.records);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [currentMonth]);

  const fmtNoDec = (v: number) => Number(v.toFixed(0)).toLocaleString();

  // Filter analysis by person
  const filteredAnalysis = useMemo(() => {
    if (personFilter === 'all') return [...analysis].sort((a, b) => b.totalAmount - a.totalAmount);
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

  // Filter details by person
  const filteredDetails = useMemo(() => {
    if (personFilter === 'all') return details;
    return details.filter((d) => d.person === personFilter);
  }, [details, personFilter]);

  // Filter income by person
  const filteredIncome = useMemo(() => {
    if (personFilter === 'all') return incomeRecords;
    return incomeRecords.filter((r) => r.person === personFilter);
  }, [incomeRecords, personFilter]);

  // 合并每人多条“余额宝”收益为一条，用于统计与展示
  const aggregatedIncome = useMemo(() => {
    if (!filteredIncome || !filteredIncome.length) return [] as IncomeRecord[];
    const isYuebao = (r: IncomeRecord) => (r.category || '').includes('余额宝') || (r.channel || '').includes('余额宝');
    const sums: Record<string, { amount: number; notes: string[]; channels: Set<string> }> = {};
    const others: IncomeRecord[] = [];
    filteredIncome.forEach((r) => {
      if (isYuebao(r)) {
        const p = r.person;
        if (!sums[p]) sums[p] = { amount: 0, notes: [], channels: new Set() };
        sums[p].amount += Number(r.amount || 0);
        if (r.note) sums[p].notes.push(r.note);
        if (r.channel) sums[p].channels.add(r.channel);
      } else {
        others.push(r);
      }
    });
    const agg = Object.keys(sums).map((p) => ({
      person: p as 'BB' | 'LN',
      time: '',
      category: '余额宝收益',
      amount: sums[p].amount,
      channel: Array.from(sums[p].channels).join(','),
      account: '',
      note: sums[p].notes.join('; '),
    }));
    return [...agg, ...others];
  }, [filteredIncome]);

  const totalExpense = filteredAnalysis.reduce((s, c) => s + c.totalAmount, 0);
  const totalIncome = aggregatedIncome.reduce((s, r) => s + Math.abs(r.amount), 0);

  const trendOption = useMemo(() => {
    const hasData = filteredAnalysis.some((c) => c.totalAmount > 0);
    if (!hasData) return null;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: any) => {
          const title = params[0]?.axisValue || '';
          return `<div style="font-weight:600;margin-bottom:4px">${title}</div>` +
            params.map((p: any) => `<div style="display:flex;justify-content:space-between;gap:16px"><span>${p.marker} ${p.seriesName}</span><b>¥${fmtNoDec(p.value)}</b></div>`).join('');
        },
      },
      legend: {
        data: personFilter === 'all' ? ['BB', 'LN'] : [personFilter],
        textStyle: { color: '#9f927d' },
      },
      xAxis: {
        type: 'category' as const,
        data: filteredAnalysis.filter((c) => c.totalAmount > 0).map((c) => c.category),
        axisLabel: { color: '#9f927d', rotate: 30 },
        axisLine: { lineStyle: { color: '#d6c9b8' } },
      },
      yAxis: {
        type: 'value' as const,
        splitLine: { lineStyle: { color: '#e8e2d6' } },
        axisLabel: { color: '#9f927d' },
      },
      grid: { left: 60, right: 20, top: 40, bottom: 60 },
      series: personFilter === 'all' ? [
        {
          name: 'BB',
          type: 'bar',
          barWidth: '30%',
          itemStyle: { color: '#19c8b9', borderRadius: [4, 4, 0, 0] },
          data: filteredAnalysis.filter((c) => c.totalAmount > 0).map((c) => c.bbAmount),
        },
        {
          name: 'LN',
          type: 'bar',
          barWidth: '30%',
          itemStyle: { color: '#6fba2c', borderRadius: [4, 4, 0, 0] },
          data: filteredAnalysis.filter((c) => c.totalAmount > 0).map((c) => c.lnAmount),
        },
      ] : [
        {
          name: personFilter,
          type: 'bar',
          barWidth: '40%',
          itemStyle: { color: personFilter === 'BB' ? '#19c8b9' : '#6fba2c', borderRadius: [4, 4, 0, 0] },
          data: filteredAnalysis.filter((c) => c.totalAmount > 0).map((c) => c.totalAmount),
        },
      ],
    };
  }, [filteredAnalysis, personFilter]);

  // Build data source with a total row at bottom
  const dataSource = useMemo(() => {
    const rows: any[] = filteredAnalysis.map((c, i) => ({ ...c, key: i }));
    rows.push({
      key: '__total__',
      category: '合计',
      bbAmount: filteredAnalysis.reduce((s, c) => s + c.bbAmount, 0),
      lnAmount: filteredAnalysis.reduce((s, c) => s + c.lnAmount, 0),
      totalAmount: filteredAnalysis.reduce((s, c) => s + c.totalAmount, 0),
      isTotal: true,
    });
    return rows;
  }, [filteredAnalysis]);

  const s = (v: number) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Dynamic columns based on person filter
  const tableColumns = useMemo(() => {
    const cols: any[] = [
      {
        title: '分类',
        dataIndex: 'category',
        key: 'category',
        render: (v: string, record: any) => record.isTotal ? <strong>合计</strong> : v,
      },
    ];
    if (personFilter === 'all') {
      cols.push(
        {
          title: 'LN 支出', dataIndex: 'lnAmount', key: 'lnAmount',
          render: (v: number, record: any) => record.isTotal
            ? <><span style={{ color: '#6fba2c', fontSize: 12, marginRight: 2 }}>●</span><strong style={{ color: '#6fba2c', fontSize: 15 }}>{s(v)}</strong></>
            : `¥${v.toFixed(2)}`,
        },
        {
          title: 'BB 支出', dataIndex: 'bbAmount', key: 'bbAmount',
          render: (v: number, record: any) => record.isTotal
            ? <><span style={{ color: '#19c8b9', fontSize: 12, marginRight: 2 }}>●</span><strong style={{ color: '#19c8b9', fontSize: 15 }}>{s(v)}</strong></>
            : `¥${v.toFixed(2)}`,
        },
        {
          title: '总支出', dataIndex: 'totalAmount', key: 'totalAmount',
          render: (v: number, record: any) => record.isTotal
            ? <strong style={{ color: '#1677ff', fontSize: 15 }}>{s(v)}</strong>
            : `¥${v.toFixed(2)}`,
        },
      );
    } else {
      cols.push(
        {
          title: '支出', dataIndex: 'totalAmount', key: 'totalAmount',
          render: (v: number, record: any) => record.isTotal
            ? <strong style={{ color: '#1677ff', fontSize: 15 }}>{s(v)}</strong>
            : `¥${v.toFixed(2)}`,
        },
      );
    }
    cols.push({
      title: '占比',
      key: 'ratio',
      render: (_: any, record: any) => record.isTotal ? null : (
        <Progress
          percent={totalExpense > 0 ? Number((record.totalAmount / totalExpense * 100).toFixed(1)) : 0}
          size="small"
          format={(pct) => `${pct}%`}
        />
      ),
    });
    return cols;
  }, [personFilter, totalExpense]);

  if (loading) {
    return <Spin><div style={{ height: 400 }} /></Spin>;
  }

  return (
    <div>
      <div className="page-header"><h2>支出分析</h2></div>

      <Space style={{ marginBottom: 16 }}>
        <Select
          value={currentMonth || undefined}
          onChange={setCurrentMonth}
          options={availableMonths.map((m) => ({ value: m, label: m }))}
          placeholder="选择月份"
          style={{ width: 140 }}
        />
        <Select
          value={personFilter}
          onChange={setPersonFilter}
          options={[
            { value: 'all', label: '全部' },
            { value: 'BB', label: 'BB' },
            { value: 'LN', label: 'LN' },
          ]}
          style={{ width: 100 }}
        />
      </Space>

      {!currentMonth ? (
        <Empty description="请选择月份" />
      ) : (
        <>
          {/* Summary cards */}
          <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <StatCard title="收入" value={totalIncome} precision={0} prefix={<ArrowUpOutlined />} color="#52c41a" />
            </Col>
            <Col xs={12} sm={6}>
              <StatCard title="支出" value={totalExpense} precision={0} prefix={<ArrowDownOutlined />} color="#ff4d4f" />
            </Col>
            <Col xs={12} sm={6}>
              <StatCard title="净余额" value={totalIncome - totalExpense} precision={0} color="#1677ff" />
            </Col>
            <Col xs={12} sm={6}>
              <StatCard title="记录数" value={filteredDetails.length} precision={0} color="#9f927d" />
            </Col>
          </Row>

          <Card className="chart-card" title="分类汇总" style={{ marginBottom: 16 }}>
            <Table
              dataSource={dataSource}
              columns={tableColumns}
              pagination={false}
              size="small"
              rowClassName={(record: any) => record.isTotal ? 'total-row' : ''}
              onRow={(record: any) => record.isTotal ? { style: { backgroundColor: '#f8f9fb', borderTop: '2px solid #e8e2d6' } } : {}}
              expandable={{
                rowExpandable: (record: any) => !record.isTotal,
                expandedRowRender: (record: any) => {
                  const txns = filteredDetails.filter(
                    (t) => (t.liveCategory || t.targetCategory || t.rawCategory) === record.category
                  );
                  return (
                    <Table
                      dataSource={txns.map((t, i) => ({ ...t, key: i }))}
                      columns={[
                        { title: '时间', dataIndex: 'time', render: (v: string) => v?.slice(0, 16) },
                        { title: '人员', dataIndex: 'person', width: 60 },
                        { title: '金额', dataIndex: 'amount', render: (v: number) => `¥${Math.abs(v).toFixed(2)}`, width: 100 },
                        { title: '描述', dataIndex: 'description' },
                      ]}
                      pagination={false}
                      size="small"
                    />
                  );
                },
              }}
            />
          </Card>

          {trendOption && (
            <Card className="chart-card" title="分类对比">
              <ReactEChartsCore option={trendOption} style={{ height: 350 }} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
