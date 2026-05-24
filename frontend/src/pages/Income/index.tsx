import { useState } from 'react';
import {
  Button, Upload, Card, Select, message, Tabs, InputNumber, Tag, Space, Table, Empty, Alert,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import * as api from '../../api';
import type { OcrResult } from '../../types';

const { Dragger } = Upload;
const { TabPane } = Tabs;

export default function IncomePage() {
  const [month, setMonth] = useState('');
  const [person, setPerson] = useState<'BB' | 'LN'>('BB');
  const [fileList, setFileList] = useState<any[]>([]);
  const [results, setResults] = useState<OcrResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingFields, setEditingFields] = useState<Record<string, Record<string, number>>>({});

  const handleOcr = async () => {
    if (fileList.length === 0) {
      message.error('请上传截图');
      return;
    }
    setLoading(true);
    try {
      const files = fileList.map((f) => f.originFileObj);
      const res = await api.ocrUpload(person, files);
      setResults(res.results);
      // Initialize editing fields
      const fields: Record<string, Record<string, number>> = {};
      res.results.forEach((r, idx) => {
        fields[String(idx)] = { ...r.fields };
      });
      setEditingFields(fields);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!month) {
      message.error('请选择月份');
      return;
    }
    setLoading(true);
    try {
      // Merge all fields from all results
      const mergedData: Record<string, unknown> = {};
      Object.values(editingFields).forEach((fields) => {
        Object.assign(mergedData, fields);
      });
      await api.ocrConfirm(month, person, mergedData);
      message.success('资产数据已保存');
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (idx: string, key: string, value: number) => {
    setEditingFields((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], [key]: value },
    }));
  };

  const fieldLabels: Record<string, string> = {
    alipay_fund: '基金',
    alipay_yuebao: '余额宝',
    alipay_balance: '余额',
    wechat_balance: '零钱',
    wechat_licaitong: '零钱通',
    bank_balance: '可用余额',
  };

  return (
    <div>
      <div className="page-header"><h2>识别收入与余额</h2></div>

      <Card className="chart-card">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Space>
            <Select
              value={month || undefined}
              onChange={setMonth}
              placeholder="选择月份"
              style={{ width: 140 }}
            />
            <Tabs activeKey={person} onChange={(k) => setPerson(k as 'BB' | 'LN')} style={{ marginBottom: 0 }}>
              <TabPane tab="斌的截图" key="BB" />
              <TabPane tab="纳的截图" key="LN" />
            </Tabs>
          </Space>

          <Dragger
            multiple
            accept=".png,.jpg,.jpeg"
            fileList={fileList}
            onChange={({ fileList: fl }) => setFileList(fl)}
            beforeUpload={() => false}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">上传支付宝/微信/银行卡截图</p>
            <p className="ant-upload-hint">支持 PNG、JPG 格式，单张不超过 5MB</p>
          </Dragger>

          <Space>
            <Button type="primary" loading={loading} onClick={handleOcr}>
              开始识别
            </Button>
          </Space>

          {results.length > 0 && (
            <>
              {results.map((r, idx) => (
                <Card
                  key={idx}
                  size="small"
                  title={`${r.filename} — ${channelLabel(r.channel)}`}
                  extra={
                    <Tag color={r.confidence > 0.8 ? 'green' : r.confidence > 0.6 ? 'orange' : 'red'}>
                      {Math.round(r.confidence * 100)}%
                    </Tag>
                  }
                >
                  {r.detectedPerson && r.detectedPerson !== person && (
                    <Alert
                      type="warning"
                      showIcon
                      message={`检测到此截图可能是 ${r.detectedPerson} 的账户`}
                      style={{ marginBottom: 12 }}
                    />
                  )}
                  {Object.keys(r.fields).length === 0 ? (
                    <Empty description="未识别到有效金额" />
                  ) : (
                    <Table
                      dataSource={Object.entries(r.fields).map(([key, val]) => ({
                        key,
                        field: fieldLabels[key] || key,
                        value: editingFields[String(idx)]?.[key] ?? val,
                      }))}
                      columns={[
                        { title: '字段', dataIndex: 'field', width: 120 },
                        {
                          title: '金额',
                          dataIndex: 'value',
                          render: (val: number, record) => (
                            <InputNumber
                              value={val}
                              onChange={(v) => updateField(String(idx), record.key, v ?? 0)}
                              min={0}
                              precision={2}
                              prefix="¥"
                              style={{ width: 180 }}
                            />
                          ),
                        },
                      ]}
                      pagination={false}
                      size="small"
                    />
                  )}
                </Card>
              ))}

              <Button type="primary" size="large" loading={loading} onClick={handleConfirm}>
                确认保存
              </Button>
            </>
          )}
        </Space>
      </Card>
    </div>
  );
}

function channelLabel(channel: string): string {
  const map: Record<string, string> = {
    alipay: '支付宝',
    wechat: '微信',
    bank_card: '银行卡',
    unknown: '未知',
  };
  return map[channel] || channel;
}
