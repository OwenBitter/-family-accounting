import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Select, Empty, Spin, Table, Progress, Space, Button, Alert, Descriptions, Tag, Modal } from 'antd';
import {
  WalletOutlined, ArrowUpOutlined, ArrowDownOutlined, SaveOutlined, DownloadOutlined,
} from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react';
import { useAppStore } from '../../store/useAppStore';
import * as api from '../../api';
import StatCard from '../../components/StatCard';
import type { CategoryAnalysis, Transaction, AssetData, LoanRecord, GoldItem } from '../../types';

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
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [loanBook, setLoanBook] = useState<LoanRecord[]>([]);
  const [gold, setGold] = useState<GoldItem[]>([]);
  const [goldPrice, setGoldPrice] = useState(0);
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [exportMonth, setExportMonth] = useState<string>('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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
        api.fetchAssets(currentMonth),
      ]).then(([, exp, ast]) => {
        if (exp?.analysis) setAnalysis(exp.analysis);
        if (exp?.details) setDetails(exp.details);
        if (ast?.data) setAssets(ast.data);
      }).catch(() => {}).finally(() => setLoading(false));
      fetchTrend();
    }
  }, [currentMonth, fetchSummary, fetchTrend]);

  useEffect(() => {
    Promise.all([
      api.fetchInvestments(),
      api.fetchGoldPrice(),
    ]).then(([inv, gp]) => {
      if (inv.loanBook) setLoanBook(inv.loanBook);
      if (inv.gold) setGold(inv.gold);
      if (gp.pricePerGram) setGoldPrice(gp.pricePerGram);
    }).catch(() => {});
  }, []);

  const filteredDetails = useMemo(() => {
    if (personFilter === 'all') return details;
    return details.filter((d) => d.person === personFilter);
  }, [details, personFilter]);

  const filteredAnalysis = useMemo(() => {
    if (personFilter === 'all') return analysis;
    return analysis.map((c) => ({
      ...c,
      bbAmount: personFilter === 'BB' ? c.bbAmount : 0,
      lnAmount: personFilter === 'LN' ? c.lnAmount : 0,
      totalAmount: personFilter === 'BB' ? c.bbAmount : personFilter === 'LN' ? c.lnAmount : 0,
    }));
  }, [analysis, personFilter]);

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

  const tooltipStyle = { backgroundColor: 'rgba(30,30,30,0.95)', borderColor: '#444', textStyle: { color: '#e5e5e5', fontSize: 12 } };

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
            params.map((p: any) => `<div style="display:flex;justify-content:space-between;gap:20px"><span>${p.marker} ${p.seriesName}</span><b>¥${Number(p.value).toLocaleString()}</b></div>`).join('');
        },
      },
      legend: { data: ['收入', '支出', '本月攒'], textStyle: { color: '#a0a0a0' }, top: 0, itemWidth: 16, itemHeight: 8 },
      xAxis: { type: 'category' as const, data: months, axisLine: { lineStyle: { color: '#303030' } },
        axisLabel: { color: '#a0a0a0', rotate: months.length > 12 ? 45 : 0, fontSize: 10 } },
      yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#252525', type: 'dashed' as const } },
        axisLabel: { color: '#a0a0a0', formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v) } },
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      series: [
        { name: '收入', type: 'line', smooth: true, symbol: 'circle', symbolSize: 5, lineStyle: { width: 2 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(82,196,26,0.25)' }, { offset: 1, color: 'rgba(82,196,26,0.02)' }] } },
          itemStyle: { color: '#52c41a' }, data: trendData.map((d) => d.income) },
        { name: '支出', type: 'line', smooth: true, symbol: 'diamond', symbolSize: 5, lineStyle: { width: 2 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255,77,79,0.25)' }, { offset: 1, color: 'rgba(255,77,79,0.02)' }] } },
          itemStyle: { color: '#ff4d4f' }, data: trendData.map((d) => d.expense) },
        { name: '本月攒', type: 'line', smooth: true, symbol: 'triangle', symbolSize: 5, lineStyle: { width: 2, type: 'dashed' as const }, itemStyle: { color: '#1677ff' }, data: trendData.map((d) => d.saved) },
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
        `<div style="font-weight:600;margin-bottom:4px">${p.name}</div>¥${Number(p.value).toLocaleString()} (${p.percent}%)` },
      legend: { type: 'scroll' as const, orient: 'vertical' as const, right: 10, textStyle: { color: '#a0a0a0', fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['42%', '68%'], center: ['32%', '50%'], avoidLabelOverlap: true,
        label: { show: true, position: 'outside', formatter: '{b}\n{d}%', color: '#c0c0c0', fontSize: 10, lineHeight: 14 },
        labelLine: { lineStyle: { color: '#555' } },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
        color: ['#1677ff','#52c41a','#ff8800','#722ed1','#13c2c2','#ff4d4f','#faad14','#2f54eb','#eb2f96','#a0d911','#434343'],
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
            params.map((p: any) => `<div style="display:flex;justify-content:space-between;gap:16px"><span>${p.marker} ${p.seriesName}</span><b>¥${Number(p.value).toLocaleString()}</b></div>`).join('');
        },
      },
      legend: { data: ['BB', 'LN'], textStyle: { color: '#a0a0a0' }, top: 0, itemWidth: 16, itemHeight: 8 },
      xAxis: { type: 'category' as const, data: cats.map((c) => c.category),
        axisLabel: { color: '#a0a0a0', rotate: 30, fontSize: 10 }, axisLine: { lineStyle: { color: '#303030' } } },
      yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#252525' } },
        axisLabel: { color: '#a0a0a0', formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v) } },
      grid: { left: 50, right: 20, top: 30, bottom: 60 },
      series: [
        { name: 'BB', type: 'bar', barWidth: '28%', barGap: '30%',
          itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] }, data: cats.map((c) => c.bbAmount) },
        { name: 'LN', type: 'bar', barWidth: '28%',
          itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] }, data: cats.map((c) => c.lnAmount) },
      ],
    };
  }, [filteredAnalysis]);

  /* ── 资产堆叠图 ── */
  const assetStackOption = useMemo(() => {
    if (!assets.length) return null;
    const persons = assets.map((a) => a.person);
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' as const, ...tooltipStyle },
      legend: { data: ['余额宝', '基金', '余额/零钱', '零钱通', '银行卡'], textStyle: { color: '#a0a0a0' }, top: 0, itemWidth: 16, itemHeight: 8 },
      xAxis: { type: 'category' as const, data: persons, axisLabel: { color: '#e5e5e5', fontSize: 13, fontWeight: 'bold' as any }, axisLine: { lineStyle: { color: '#303030' } } },
      yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#252525' } }, axisLabel: { color: '#a0a0a0', formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v) } },
      grid: { left: 50, right: 20, top: 30, bottom: 30 },
      series: [
        { name: '余额宝', type: 'bar', stack: 'total', barWidth: 40, itemStyle: { color: '#1677ff' }, data: assets.map((a) => a.alipayYuebao) },
        { name: '基金', type: 'bar', stack: 'total', itemStyle: { color: '#722ed1' }, data: assets.map((a) => a.alipayFund) },
        { name: '余额/零钱', type: 'bar', stack: 'total', itemStyle: { color: '#13c2c2' }, data: assets.map((a) => a.alipayBalance + a.wechatBalance) },
        { name: '零钱通', type: 'bar', stack: 'total', itemStyle: { color: '#52c41a' }, data: assets.map((a) => a.wechatLicaitong) },
        { name: '银行卡', type: 'bar', stack: 'total', itemStyle: { color: '#faad14' }, data: assets.map((a) => Object.values(a.bankAccounts).reduce((s, v) => s + v, 0)) },
      ],
    };
  }, [assets]);

  const totalExpense = filteredAnalysis.reduce((s, c) => s + c.totalAmount, 0);

  const tableColumns = [
    { title: '分类', dataIndex: 'category', key: 'category', sorter: (a: CategoryAnalysis, b: CategoryAnalysis) => a.category.localeCompare(b.category) },
    { title: 'LN 支出', dataIndex: 'lnAmount', key: 'lnAmount', sorter: (a: CategoryAnalysis, b: CategoryAnalysis) => a.lnAmount - b.lnAmount, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: 'BB 支出', dataIndex: 'bbAmount', key: 'bbAmount', sorter: (a: CategoryAnalysis, b: CategoryAnalysis) => a.bbAmount - b.bbAmount, render: (v: number) => `¥${v.toFixed(2)}` },
    { title: '总支出', dataIndex: 'totalAmount', key: 'totalAmount', sorter: (a: CategoryAnalysis, b: CategoryAnalysis) => a.totalAmount - b.totalAmount, render: (v: number) => `¥${v.toFixed(2)}` },
    {
      title: '占比', key: 'ratio', sorter: (a: CategoryAnalysis, b: CategoryAnalysis) => a.totalAmount - b.totalAmount,
      render: (_: any, record: CategoryAnalysis) => (
        <Progress percent={totalExpense > 0 ? Number((record.totalAmount / totalExpense * 100).toFixed(1)) : 0} size="small" format={(pct) => `${pct}%`} />
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" className="page-header">
        <Col><h2>总览</h2></Col>
        <Col>
          <Space>
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
            <Col xs={12} sm={3}><StatCard title="总资产" value={summary.total.grandTotal} precision={0} prefix={<WalletOutlined />} color="#1677ff" /></Col>
            <Col xs={12} sm={3}><StatCard title="收入" value={summary.total.income} precision={0} prefix={<ArrowUpOutlined />} color="#52c41a" /></Col>
            <Col xs={12} sm={3}><StatCard title="支出" value={summary.total.expense} precision={0} prefix={<ArrowDownOutlined />} color="#ff4d4f" /></Col>
            <Col xs={12} sm={3}><StatCard title="本月攒" value={summary.total.saved} precision={0} prefix={<SaveOutlined />} color="#ffd700" /></Col>
            <Col xs={12} sm={3}><StatCard title="余额" value={summary.bb.lastBalance + summary.ln.lastBalance} precision={0} color="#a0a0a0" /></Col>
            <Col xs={12} sm={3}><StatCard title="外借" value={summary.total.externalAsset} precision={0} prefix={<WalletOutlined />} color="#ff8800" /></Col>
            <Col xs={12} sm={3}>
              <div style={{ cursor: 'pointer' }} onClick={() => window.location.hash = '#/investment'}>
                <StatCard title="黄金价值" value={gold.reduce((s, g) => s + g.weight, 0) * goldPrice} precision={0} prefix={<WalletOutlined />} color="#ffd700" />
              </div>
            </Col>
            <Col xs={12} sm={3}>
              <div style={{ cursor: 'pointer' }} onClick={() => window.location.hash = '#/investment'}>
                <StatCard title="外借在收" value={loanBook.filter((r) => !r.note.includes('已取走')).reduce((s, r) => s + r.amount, 0)} precision={0} prefix={<WalletOutlined />} color="#13c2c2" />
              </div>
            </Col>
          </Row>

          {/* 资产详情 + 分类汇总（并列） */}
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} md={12} style={{ display: 'flex' }}>
              {assets.length > 0 && (
                <Card className="chart-card" title="资产构成" style={{ flex: 1 }}>
              {(summary.total.externalAsset > 0 || summary.total.otherAsset > 0) && (
                <Alert type="info" showIcon style={{ marginBottom: 12 }}
                  message={`外借资产 ¥${summary.total.externalAsset.toFixed(2)}　其他资产 ¥${summary.total.otherAsset.toFixed(2)}　合计 ¥${(summary.total.externalAsset + summary.total.otherAsset).toFixed(2)}`} />
              )}
              <Row gutter={24}>
                {assets.map((a) => (
                  <Col span={12} key={a.person}>
                    <Descriptions
                      column={1} size="small"
                      labelStyle={{ color: '#a0a0a0' }}
                      contentStyle={{ color: '#e5e5e5' }}
                      title={<Tag color={a.person === 'BB' ? 'blue' : 'green'}>{a.person === 'BB' ? '斌' : '纳'}的资产</Tag>}
                    >
                      <Descriptions.Item label="基金">¥{(a.alipayFund || 0).toFixed(0)}</Descriptions.Item>
                      <Descriptions.Item label="余额宝">¥{(a.alipayYuebao || 0).toFixed(0)}</Descriptions.Item>
                      <Descriptions.Item label="余额/零钱">¥{((a.alipayBalance || 0) + (a.wechatBalance || 0)).toFixed(0)}</Descriptions.Item>
                      <Descriptions.Item label="零钱通">¥{(a.wechatLicaitong || 0).toFixed(0)}</Descriptions.Item>
                      {Object.entries(a.bankAccounts || {})
                        .filter(([k]) => k !== '总额')
                        .map(([bank, amt]) => (
                        <Descriptions.Item label={bank} key={bank}>¥{(amt || 0).toFixed(0)}</Descriptions.Item>
                      ))}
                      {Object.entries(a.other || {}).map(([name, amt]) => (
                        <Descriptions.Item label={name} key={name}>¥{(amt || 0).toFixed(0)}</Descriptions.Item>
                      ))}
                      <Descriptions.Item label={<strong>合计</strong>}><strong style={{ color: '#1677ff' }}>¥{(a.total || 0).toFixed(0)}</strong></Descriptions.Item>
                    </Descriptions>
                  </Col>
                ))}
              </Row>
              {assetStackOption && (
                <ReactEChartsCore option={assetStackOption} style={{ height: 250, marginTop: 16 }} />
              )}
            </Card>
            )}
            </Col>
            <Col xs={24} md={12} style={{ display: 'flex' }}>
              <Card className="chart-card" title="分类汇总" style={{ flex: 1 }}>
                <Table
                  dataSource={filteredAnalysis.map((c, i) => ({ ...c, key: i }))}
                  columns={tableColumns} pagination={false} size="small"
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}><strong>合计</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={1}><strong>¥{filteredAnalysis.reduce((s, c) => s + c.lnAmount, 0).toFixed(2)}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={2}><strong>¥{filteredAnalysis.reduce((s, c) => s + c.bbAmount, 0).toFixed(2)}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={3}><strong>¥{totalExpense.toFixed(2)}</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={4} />
                    </Table.Summary.Row>
                  )}
                  expandable={filteredDetails.length > 0 ? {
                    expandedRowRender: (record: CategoryAnalysis) => {
                      const txns = filteredDetails.filter((t) => (t.targetCategory || t.rawCategory) === record.category);
                      return (
                        <div style={{ maxHeight: 260, overflowY: 'auto', overflowX: 'hidden' }}>
                          <Table dataSource={txns.map((t, i) => ({ ...t, key: i }))}
                            columns={[
                              { title: '时间', dataIndex: 'time', render: (v: string) => v?.slice(0, 16) },
                              { title: '人员', dataIndex: 'person', width: 60 },
                              { title: '金额', dataIndex: 'amount', render: (v: number) => `¥${Math.abs(v).toFixed(2)}`, width: 100 },
                              { title: '描述', dataIndex: 'description' },
                            ]}
                            pagination={false} size="small" />
                        </div>
                      );
                    },
                  } : undefined}
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
        </>
      )}
    </div>
  );
}
