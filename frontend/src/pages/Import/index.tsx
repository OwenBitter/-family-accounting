import { useState, useEffect } from 'react';
import { Steps, Button, Select, Upload, Table, message, Alert, Space, Card, InputNumber, Input, DatePicker } from 'antd';
import { InboxOutlined, ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import * as api from '../../api';
import type { Transaction } from '../../types';
import dayjs from 'dayjs';

const { Dragger } = Upload;

const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}月` }));
const yearOptions = Array.from({ length: 10 }, (_, i) => {
  const y = 2020 + i;
  return { value: String(y), label: `${y}年` };
});

export default function ImportPage() {
  return (
    <div>
      <div className="page-header"><h2>导入数据</h2></div>
      <Card className="chart-card" title="导入支出（支付宝 CSV / 微信 xlsx）">
        <ImportExpense />
      </Card>
      <Card className="chart-card" style={{ marginTop: 16 }} title="手动记账">
        <ManualEntry />
      </Card>
    </div>
  );
}

/* ─── 导入支出（文件导入） ─── */
function ImportExpense() {
  const navigate = useNavigate();
  const currentMonth = useAppStore((s) => s.currentMonth);
  const importStep = useAppStore((s) => s.importStep);
  const setImportStep = useAppStore((s) => s.setImportStep);
  const setPreviewData = useAppStore((s) => s.setPreviewData);
  const previewData = useAppStore((s) => s.previewData);
  const previewStatistics = useAppStore((s) => s.previewStatistics);

  const [person, setPerson] = useState<string>('BB');
  const [month, setMonth] = useState<string>(currentMonth || '');
  const [fileList, setFileList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    api.fetchCategories().then((res) => {
      setCategories(res.categories);
    }).catch(() => {
      message.error('获取分类列表失败');
    });
  }, []);

  const handleUploadAndPreview = async () => {
    if (!month) { message.error('请选择月份'); return; }
    if (fileList.length === 0) { message.error('请上传文件'); return; }
    setLoading(true);
    try {
      const files = fileList.map((f) => f.originFileObj);
      const res = await api.importPreview(person, month, files, true);
      setPreviewData(res.transactions, res.statistics);
      setDuplicates(res.duplicateOrderIds);
      setWarnings(res.personWarnings);
      setImportStep(2);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    try {
      const res = await api.importConfirm(person, month, previewData);
      message.success(`成功导入 ${res.addedCount} 条记录`);
      setImportStep(3);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 150, render: (v: string) => v?.slice(0, 16) },
    { title: '原始分类', dataIndex: 'rawCategory', key: 'rawCategory', width: 120 },
    { title: '金额', dataIndex: 'amount', key: 'amount', width: 100, render: (v: number) => `¥${Math.abs(v).toFixed(2)}` },
    { title: '支付方式', dataIndex: 'paymentMethod', key: 'paymentMethod', width: 100 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '交易对方', dataIndex: 'counterparty', key: 'counterparty', width: 120, ellipsis: true },
    {
      title: '映射分类', dataIndex: 'targetCategory', key: 'targetCategory', width: 180,
      render: (cat: string, record: Transaction) => (
        <Select
          value={cat || undefined} style={{ width: 160 }}
          options={categories.map((c) => ({ value: c, label: c }))}
          status={!cat || cat === '其他' ? 'error' : undefined}
          onChange={(val) => { record.targetCategory = val; }}
        />
      ),
    },
  ];

  return (
    <div>
      <Steps current={importStep} style={{ marginBottom: 24, marginTop: 8 }} size="small">
        <Steps.Step title="选月份与人员" />
        <Steps.Step title="上传文件" />
        <Steps.Step title="预览与修正" />
        <Steps.Step title="确认" />
      </Steps>

      {importStep === 0 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 4, color: '#a0a0a0' }}>选择月份</div>
            <Select value={month.split('.')[0] || undefined}
              onChange={(y) => setMonth(y ? `${y}.${month.split('.')[1] || '1'}` : '')}
              options={yearOptions} placeholder="年" style={{ width: 100 }} allowClear />
            <span style={{ color: '#a0a0a0', margin: '0 4px' }}>年</span>
            <Select value={month.split('.')[1] || undefined}
              onChange={(m) => setMonth(m ? `${month.split('.')[0] || '2026'}.${m}` : '')}
              options={monthOptions} placeholder="月" style={{ width: 90 }} allowClear />
            <span style={{ color: '#a0a0a0', margin: '0 4px' }}>月</span>
          </div>
          <div>
            <div style={{ marginBottom: 4, color: '#a0a0a0' }}>选择人员</div>
            <Space>
              <Button type={person === 'BB' ? 'primary' : 'default'} size="large"
                onClick={() => setPerson('BB')} style={{ width: 120, height: 60 }}>
                斌 (BB)
              </Button>
              <Button type={person === 'LN' ? 'primary' : 'default'} size="large"
                onClick={() => setPerson('LN')} style={{ width: 120, height: 60 }}>
                纳 (LN)
              </Button>
            </Space>
          </div>
          <Button type="primary" onClick={() => setImportStep(1)}>下一步</Button>
        </Space>
      )}

      {importStep === 1 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Dragger multiple accept=".csv,.xlsx" fileList={fileList}
            onChange={({ fileList: fl }) => setFileList(fl)} beforeUpload={() => false}>
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">支持支付宝 CSV 和微信 xlsx 格式</p>
          </Dragger>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setImportStep(0)}>上一步</Button>
            <Button type="primary" loading={loading} onClick={handleUploadAndPreview}>预览解析结果</Button>
          </Space>
        </Space>
      )}

      {importStep === 2 && (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {warnings.length > 0 && (
            <Alert type="warning" showIcon message="人员匹配提示"
              description={warnings.map((w) => `文件 "${w.file}" 检测为 ${w.detectedPerson} 的数据`).join('；')} />
          )}
          {duplicates.length > 0 && (
            <Alert type="info" showIcon message={`检测到 ${duplicates.length} 条重复交易`} />
          )}
          {previewStatistics && (
            <Alert type="info" showIcon
              message={`共 ${previewStatistics.totalCount} 笔，支出合计 ¥${previewStatistics.totalExpense.toFixed(2)}，未匹配 ${previewStatistics.unmappedCount} 笔`} />
          )}
          <Table dataSource={previewData.map((t, i) => ({ ...t, key: i }))} columns={columns}
            size="small" scroll={{ x: 900, y: 400 }} pagination={{ pageSize: 50 }} />
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setImportStep(1)}>上一步</Button>
            <Button type="primary" loading={loading} onClick={handleConfirmImport}>确认导入</Button>
          </Space>
        </Space>
      )}

      {importStep === 3 && (
        <Space direction="vertical" size="middle" style={{ width: '100%', textAlign: 'center' }}>
          <Alert type="success" showIcon message="导入成功！" />
          <Space>
            <Button onClick={() => { setImportStep(0); setPreviewData([]); setFileList([]); }}>继续导入</Button>
            <Button type="primary" onClick={() => navigate('/')}>去仪表盘查看</Button>
          </Space>
        </Space>
      )}
    </div>
  );
}

/* ─── 手动记账 ─── */
function ManualEntry() {
  const currentMonth = useAppStore((s) => s.currentMonth);
  const [person, setPerson] = useState<'BB' | 'LN'>('BB');
  const [monthYear, setMonthYear] = useState<string>(currentMonth?.split('.')[0] || dayjs().format('YYYY'));
  const [monthNum, setMonthNum] = useState<string>(currentMonth?.split('.')[1] || dayjs().format('M'));
  const [date, setDate] = useState<string>(dayjs().format('YYYY-MM-DDTHH:mm:ss'));
  const [amount, setAmount] = useState<number | null>(null);
  const [category, setCategory] = useState<string>('其他');
  const [description, setDescription] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('支付宝');
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<number>(0);
  const month = `${monthYear}.${monthNum}`;

  const handleSubmit = async () => {
    if (!amount || amount <= 0) { message.error('请输入金额'); return; }
    if (!description.trim()) { message.error('请输入描述'); return; }
    if (!month) { message.error('请选择月份'); return; }

    const txn: any = {
      person,
      source: 'manual',
      time: date,
      rawCategory: category,
      targetCategory: category,
      amount: -amount,
      paymentMethod,
      description: description.trim(),
      counterparty: '',
      status: 'completed',
      order_id: `manual_${Date.now()}`,
    };

    setLoading(true);
    try {
      await api.importConfirm(person, month, [txn]);
      message.success(`已记录支出 ¥${amount?.toFixed(2)}`);
      setAdded((n) => n + 1);
      // Reset form
      setAmount(null);
      setDescription('');
      setCategory('其他');
      setDate(dayjs().format('YYYY-MM-DDTHH:mm:ss'));
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap>
        <div>
          <div style={{ marginBottom: 4, color: '#a0a0a0', fontSize: 12 }}>人员</div>
          <Button type={person === 'BB' ? 'primary' : 'default'} size="small" onClick={() => setPerson('BB')}>斌</Button>
          <Button type={person === 'LN' ? 'primary' : 'default'} size="small" onClick={() => setPerson('LN')} style={{ marginLeft: 4 }}>纳</Button>
        </div>
        <div>
          <div style={{ marginBottom: 4, color: '#a0a0a0', fontSize: 12 }}>月份</div>
          <Select value={monthYear} onChange={setMonthYear} style={{ width: 85 }}
            options={Array.from({ length: 10 }, (_, i) => ({ value: String(2020 + i), label: `${2020 + i}年` }))} />
          <Select value={monthNum} onChange={setMonthNum} style={{ width: 70 }}
            options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}月` }))} />
        </div>
        <div>
          <div style={{ marginBottom: 4, color: '#a0a0a0', fontSize: 12 }}>日期</div>
          <DatePicker showTime value={dayjs(date)} onChange={(d) => setDate(d?.format('YYYY-MM-DDTHH:mm:ss') || dayjs().format('YYYY-MM-DDTHH:mm:ss'))} />
        </div>
        <div>
          <div style={{ marginBottom: 4, color: '#a0a0a0', fontSize: 12 }}>金额</div>
          <InputNumber value={amount} onChange={setAmount} min={0} precision={2} prefix="¥" style={{ width: 140 }} placeholder="0.00" />
        </div>
        <div>
          <div style={{ marginBottom: 4, color: '#a0a0a0', fontSize: 12 }}>分类</div>
          <Select value={category} onChange={setCategory} style={{ width: 180 }}
            options={categories.map((c) => ({ value: c, label: c }))} />
        </div>
        <div>
          <div style={{ marginBottom: 4, color: '#a0a0a0', fontSize: 12 }}>支付方式</div>
          <Select value={paymentMethod} onChange={setPaymentMethod} style={{ width: 100 }}
            options={[
              { value: '支付宝', label: '支付宝' },
              { value: '微信支付', label: '微信支付' },
              { value: '银行卡', label: '银行卡' },
              { value: '现金', label: '现金' },
            ]} />
        </div>
      </Space>
      <Space wrap style={{ width: '100%' }}>
        <Input value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="输入支出描述…" style={{ width: 360 }} allowClear />
        <Button type="primary" icon={<PlusOutlined />} loading={loading} onClick={handleSubmit}>
          记录支出
        </Button>
        {added > 0 && <span style={{ color: '#52c41a', fontSize: 13 }}>已记录 {added} 笔</span>}
      </Space>
    </Space>
  );
}
