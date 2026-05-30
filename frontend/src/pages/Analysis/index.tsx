import { useEffect, useMemo, useState } from 'react';
import { Card, Select, Space, Table, Empty, Spin, Progress } from 'antd';
import ReactEChartsCore from 'echarts-for-react';
import { useAppStore } from '../../store/useAppStore';
import * as api from '../../api';
import type { CategoryAnalysis, Transaction } from '../../types';

export default function AnalysisPage() {
  const currentMonth = useAppStore((s) => s.currentMonth);
  const setCurrentMonth = useAppStore((s) => s.setCurrentMonth);
  const availableMonths = useAppStore((s) => s.availableMonths);

  const [analysis, setAnalysis] = useState<CategoryAnalysis[]>([]);
  const [details, setDetails] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [personFilter, setPersonFilter] = useState<string>('all');

  useEffect(() => {
    if (!currentMonth) return;
    setLoading(true);
    Promise.all([
      api.fetchExpenses(currentMonth),
    ]).then(([exp]) => {
      setAnalysis(exp.analysis);
      setDetails(exp.details);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [currentMonth]);

  const filteredDetails = useMemo(() => {
    if (personFilter === 'all') return details;
    return details.filter((d) => d.person === personFilter);
  }, [details, personFilter]);

  const trendOption = useMemo(() => {
    const hasData = analysis.some((c) => c.totalAmount > 0);
    if (!hasData) return null;

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' as const },
      legend: {
        data: ['BB', 'LN'],
        textStyle: { color: '#9f927d' },
      },
      xAxis: {
        type: 'category' as const,
        data: analysis.filter((c) => c.totalAmount > 0).map((c) => c.category),
        axisLabel: { color: '#9f927d', rotate: 30 },
        axisLine: { lineStyle: { color: '#d6c9b8' } },
      },
      yAxis: {
        type: 'value' as const,
        splitLine: { lineStyle: { color: '#e8e2d6' } },
        axisLabel: { color: '#9f927d' },
      },
      grid: { left: 60, right: 20, top: 40, bottom: 60 },
      series: [
        {
          name: 'BB',
          type: 'bar',
          barWidth: '30%',
          itemStyle: { color: '#19c8b9', borderRadius: [4, 4, 0, 0] },
          data: analysis.filter((c) => c.totalAmount > 0).map((c) => c.bbAmount),
        },
        {
          name: 'LN',
          type: 'bar',
          barWidth: '30%',
          itemStyle: { color: '#6fba2c', borderRadius: [4, 4, 0, 0] },
          data: analysis.filter((c) => c.totalAmount > 0).map((c) => c.lnAmount),
        },
      ],
    };
  }, [analysis]);

  const totalExpense = analysis.reduce((s, c) => s + c.totalAmount, 0);

  const tableColumns = [
    { title: '分类', dataIndex: 'category', key: 'category' },
    {
      title: 'LN 支出', dataIndex: 'lnAmount', key: 'lnAmount',
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: 'BB 支出', dataIndex: 'bbAmount', key: 'bbAmount',
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: '总支出', dataIndex: 'totalAmount', key: 'totalAmount',
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: '占比',
      key: 'ratio',
      render: (_: any, record: CategoryAnalysis) => (
        <Progress
          percent={totalExpense > 0 ? Number((record.totalAmount / totalExpense * 100).toFixed(1)) : 0}
          size="small"
          format={(pct) => `${pct}%`}
        />
      ),
    },
  ];

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
          <Card className="chart-card" title="分类汇总">
            <Table
              dataSource={analysis.map((c, i) => ({ ...c, key: i }))}
              columns={tableColumns}
              pagination={false}
              size="small"
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}><strong>合计</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={1}><strong>¥{analysis.reduce((s, c) => s + c.lnAmount, 0).toFixed(2)}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={2}><strong>¥{analysis.reduce((s, c) => s + c.bbAmount, 0).toFixed(2)}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={3}><strong>¥{totalExpense.toFixed(2)}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} />
                </Table.Summary.Row>
              )}
              expandable={{
                expandedRowRender: (record: CategoryAnalysis) => {
                  const txns = filteredDetails.filter(
                    (t) => (t.targetCategory || t.rawCategory) === record.category
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
