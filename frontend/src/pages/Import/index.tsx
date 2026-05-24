import { useState } from 'react';
import { Steps, Button, Select, Upload, Table, message, Alert, Space, Card, InputNumber, Tag } from 'antd';
import { InboxOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import * as api from '../../api';
import type { Transaction, OcrResult } from '../../types';

const { Dragger } = Upload;

const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}月` }));
const yearOptions = Array.from({ length: 10 }, (_, i) => {
  const y = 2020 + i;
  return { value: String(y), label: `${y}年` };
});

const categories = [
  '购物（网购）', '餐饮', '还款（房贷 信用卡）', '娱乐',
  '生活服务', '转账（红包、人情）', '充值缴费', '交通',
  '医疗（保险、核酸等）', '其他', '家庭支出（装修、大件）',
];

export default function ImportPage() {
  return (
    <div>
      <div className="page-header"><h2>导入数据</h2></div>
      <Card className="chart-card" title="导入支出（支付宝 CSV / 微信 xlsx）">
        <ImportExpense />
      </Card>
      <Card className="chart-card" style={{ marginTop: 16 }} title="识别收入与余额（截图 OCR）">
        <OcrIncome />
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

/* ─── 识别收入（OCR 截图） ─── */
function OcrIncome() {
  const [month, setMonth] = useState('');
  const [person, setPerson] = useState<'BB' | 'LN'>('BB');
  const [fileList, setFileList] = useState<any[]>([]);
  const [results, setResults] = useState<OcrResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingFields, setEditingFields] = useState<Record<string, Record<string, number>>>({});

  const handleOcr = async () => {
    if (fileList.length === 0) { message.error('请上传截图'); return; }
    setLoading(true);
    try {
      const files = fileList.map((f) => f.originFileObj);
      const res = await api.ocrUpload(person, files);
      setResults(res.results);
      const fields: Record<string, Record<string, number>> = {};
      res.results.forEach((r, idx) => { fields[String(idx)] = { ...r.fields }; });
      setEditingFields(fields);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!month) { message.error('请选择月份'); return; }
    setLoading(true);
    try {
      const mergedData: Record<string, unknown> = {};
      Object.values(editingFields).forEach((fields) => Object.assign(mergedData, fields));
      await api.ocrConfirm(month, person, mergedData);
      message.success('资产数据已保存');
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (idx: string, key: string, value: number) => {
    setEditingFields((prev) => ({ ...prev, [idx]: { ...prev[idx], [key]: value } }));
  };

  const fieldLabels: Record<string, string> = {
    alipay_fund: '基金', alipay_yuebao: '余额宝', alipay_balance: '余额',
    wechat_balance: '零钱', wechat_licaitong: '零钱通', bank_balance: '可用余额',
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space>
        <Select value={month.split('.')[0] || undefined}
          onChange={(y) => setMonth(y ? `${y}.${month.split('.')[1] || '1'}` : '')}
          options={yearOptions} placeholder="年" style={{ width: 100 }} allowClear />
        <span style={{ color: '#a0a0a0', margin: '0 4px' }}>年</span>
        <Select value={month.split('.')[1] || undefined}
          onChange={(m) => setMonth(m ? `${month.split('.')[0] || '2026'}.${m}` : '')}
          options={monthOptions} placeholder="月" style={{ width: 90 }} allowClear />
        <span style={{ color: '#a0a0a0', margin: '0 4px' }}>月</span>
        <Space>
          <Button type={person === 'BB' ? 'primary' : 'default'} onClick={() => setPerson('BB')}>斌的截图</Button>
          <Button type={person === 'LN' ? 'primary' : 'default'} onClick={() => setPerson('LN')}>纳的截图</Button>
        </Space>
      </Space>

      <Dragger multiple accept=".png,.jpg,.jpeg" fileList={fileList}
        onChange={({ fileList: fl }) => setFileList(fl)} beforeUpload={() => false}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">上传支付宝/微信/银行卡截图</p>
        <p className="ant-upload-hint">支持 PNG、JPG 格式，单张不超过 5MB</p>
      </Dragger>

      <Button type="primary" loading={loading} onClick={handleOcr}>开始识别</Button>

      {results.length > 0 && (
        <>
          {results.map((r, idx) => (
            <Card key={idx} size="small"
              title={`${r.filename} — ${channelLabel(r.channel)}`}
              extra={<Tag color={r.confidence > 0.8 ? 'green' : r.confidence > 0.6 ? 'orange' : 'red'}>{Math.round(r.confidence * 100)}%</Tag>}>
              {r.note && (
                <Alert type="info" showIcon message={r.note} style={{ marginBottom: 12 }} />
              )}
              {r.detectedPerson && r.detectedPerson !== person && (
                <Alert type="warning" showIcon message={`检测到此截图可能是 ${r.detectedPerson} 的账户`} style={{ marginBottom: 12 }} />
              )}
              {Object.keys(r.fields).length > 0 && (
                <Table dataSource={Object.entries(r.fields).map(([key, val]) => ({
                  key, field: fieldLabels[key] || key,
                  value: editingFields[String(idx)]?.[key] ?? val,
                }))} columns={[
                  { title: '字段', dataIndex: 'field', width: 120 },
                  { title: '金额', dataIndex: 'value',
                    render: (val: number, record) => (
                      <InputNumber value={val} onChange={(v) => updateField(String(idx), record.key, v ?? 0)}
                        min={0} precision={2} prefix="¥" style={{ width: 180 }} />
                    ),
                  },
                ]} pagination={false} size="small" />
              )}
            </Card>
          ))}
          <Button type="primary" size="large" loading={loading} onClick={handleConfirm}>确认保存</Button>
        </>
      )}
    </Space>
  );
}

function channelLabel(channel: string): string {
  const map: Record<string, string> = { alipay: '支付宝', wechat: '微信', bank_card: '银行卡', unknown: '未知' };
  return map[channel] || channel;
}
