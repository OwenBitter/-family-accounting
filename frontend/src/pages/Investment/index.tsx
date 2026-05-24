import { useEffect, useState } from 'react';
import { Card, Table, Statistic, Row, Col, Spin, Tag, Image, Typography } from 'antd';
import * as api from '../../api';
import type { LoanRecord, GoldItem } from '../../types';

const { Text } = Typography;

export default function InvestmentPage() {
  const [loanBook, setLoanBook] = useState<LoanRecord[]>([]);
  const [gold, setGold] = useState<GoldItem[]>([]);
  const [goldPrice, setGoldPrice] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.fetchInvestments(),
      api.fetchGoldPrice(),
    ]).then(([inv, gp]) => {
      if (inv.loanBook) setLoanBook(inv.loanBook);
      if (inv.gold) setGold(inv.gold);
      if (gp.pricePerGram) setGoldPrice(gp.pricePerGram);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalGoldWeight = gold.reduce((s, g) => s + g.weight, 0);
  const totalGoldValue = totalGoldWeight * goldPrice;
  const totalLoanIn = loanBook.filter((r) => !r.note.includes('已取走')).reduce((s, r) => s + r.amount, 0);

  if (loading) return <Spin><div style={{ height: 400 }} /></Spin>;

  return (
    <div>
      <div className="page-header"><h2>投资与资产</h2></div>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card className="stat-card" size="small">
            <Statistic title="黄金总量" value={totalGoldWeight} suffix="g" precision={1}
              valueStyle={{ color: '#ffd700', fontSize: 28 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" size="small">
            <Statistic title="金价（/克）" value={goldPrice} prefix="¥" precision={2}
              valueStyle={{ color: '#ffd700', fontSize: 28 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" size="small">
            <Statistic title="黄金总价值" value={totalGoldValue} prefix="¥" precision={0}
              valueStyle={{ color: '#ffd700', fontSize: 28 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" size="small">
            <Statistic title="外借在收" value={totalLoanIn} prefix="¥" precision={0}
              valueStyle={{ color: '#ff8800', fontSize: 28 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        {/* 外借资产明细 */}
        <Col xs={24} md={12} style={{ display: 'flex' }}>
          <Card className="chart-card" title={<Text style={{ color: '#e5e5e5' }}>外借资产明细</Text>} size="small" style={{ flex: 1 }}>
            <Table dataSource={loanBook.map((r, i) => ({ ...r, key: i }))}
              columns={[
                { title: '月份', dataIndex: 'month', width: 90 },
                { title: '姓名', dataIndex: 'person', width: 80 },
                { title: '金额', dataIndex: 'amount', width: 90, render: (v: number) => <Text style={{ color: '#ff8800' }}>¥{v.toFixed(0)}</Text> },
                { title: '状态', dataIndex: 'note', width: 100,
                  render: (v: string) => v.includes('已取走') ? <Tag color="red">已取走</Tag> :
                    v.includes('分红') ? <Tag color="orange">{v.replace(/\d+/g, '') || '分红'}</Tag> :
                    <Tag color="green" style={{ border: 'none' }}>在收</Tag>,
                },
                { title: '卡里总额', dataIndex: 'totalInCard', render: (v: number | null) => v ? `¥${v.toFixed(0)}` : '-' },
              ]} pagination={false} size="small" scroll={{ y: 400 }} />
          </Card>
        </Col>

        {/* 黄金资产 */}
        <Col xs={24} md={12} style={{ display: 'flex' }}>
          <Card className="chart-card" title={<Text style={{ color: '#e5e5e5' }}>{`黄金资产 (${gold.length}件)`}</Text>} size="small" style={{ flex: 1 }}>
            <Table dataSource={gold.map((g, i) => ({ ...g, key: i }))}
              columns={[
                { title: '', dataIndex: 'imageIndex', width: 60,
                  render: (idx: number) => (
                    <Image src={`/api/data/gold-image/${idx}`} width={48} height={48}
                      style={{ objectFit: 'cover', borderRadius: 4 }}
                      preview={{ mask: '查看' }}
                      fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuNvyMY98AAAIwSURBVGhD7Zk9TsNAEIX3HCAK5wii4QKcg4IjUHD/k1BwBCQaKDgCFHBTKHgvUPA7IpJNZNe7npl1nI0jW2I+aaXYu/N2/DHj9QZjjDHGmBHy9vo2eXl6nXSvbsOqMoP4hq/j+9fPyYfbZ9n3/fWTkE2pYRpJGtIh+Yy/4W18H3vzxy/4PH5GJmRDIA3p0AiB8IxkQjoE0pAOhUAIhGckE9IhkIZ0KARCIDwjmZAOgfQh3d3e8/Xx+pHcXd1O94r3+/D2/km8x/s4h9/lcxlCMiEdAmlIh0YIhGckE9IhkIZ0KARCIDwjmZAOgTR/RFbDx7fxPUjD9/E9zhNIQzo0QiA8I5mQDoE0pEMhEALhGcmEdAikIR0aIeIRSRHkN0Z0iL2/vnP4E7pGCIRACIRnJBP6EIE0pEMhEALhGcmEfkYgDelQCIQQCE/lk5mQDoE0pEMhEALhGcmEPhhIQzoUAmF1Rng2CEhDOpQICQJpSIdCIATCM5IJfTCQhnQoBII0pEMhEALhGcmEPhhIQzoUAmEtRojAHYGEyL0ikIZ0aATCiuB/EUgI7AhIQzo0AiGQhnRoBEIgDelQ/0cgDelQCIRAGs9If0YgDelQCARAmp+RTgiEQBofkY5Io7M0IiPQlwRpSIc8IxmRhnRojED9GaEhHUJ45hnpQ4Q0pEOekYxIQzpNpyF9B/pLpCEdGn0iICGQhnSoV0Z6sZEfyYR0CKQhHQqBEAiB8IxkQjoE4pA+AAAA//8DAH1eAAgr/x1OAAAAAElFTkSuQmCC" />
                  ),
                },
                { title: '名称', dataIndex: 'name', ellipsis: true },
                { title: '克重', dataIndex: 'weight', width: 60, render: (v: number) => <Text style={{ color: '#ffd700' }}>{v}g</Text> },
                { title: '来源', dataIndex: 'source', ellipsis: true },
              ]} pagination={false} size="small" scroll={{ y: 400 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
