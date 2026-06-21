import { useState, useEffect } from 'react';
import { Modal, InputNumber, Button, Space, Input, Select, Table, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as api from '../api';

interface Props {
  open: boolean;
  month: string;
  person: 'BB' | 'LN';
  onClose: () => void;
  onSaved: () => void;
}

interface IncomeItem {
  key: string;
  time: string;
  category: string;
  amount: number;
  channel: string;
  account: string;
  note: string;
}

const CATEGORY_OPTIONS = ['工资', '房租', '公司', '其他'];
const CHANNEL_OPTIONS = ['招商银行', '支付宝', '微信', '银行卡', '现金'];

export default function IncomeEditModal({ open, month, person, onClose, onSaved }: Props) {
  const [items, setItems] = useState<IncomeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && month) {
      setLoading(true);
      api.fetchIncome(month).then((res) => {
        const personRecords = (res.records || []).filter((r) => r.person === person);
        setItems(
          personRecords.length > 0
            ? personRecords.map((r, i) => ({
                key: String(i),
                time: r.time ? r.time.slice(0, 10) : dayjs().format('YYYY-MM-DD'),
                category: r.category || '其他',
                amount: Math.abs(r.amount),
                channel: r.channel || '',
                account: r.account || '',
                note: r.note || '',
              }))
            : [{
                key: '0',
                time: dayjs().format('YYYY-MM-DD'),
                category: '工资',
                amount: 0,
                channel: '',
                account: '',
                note: '',
              }]
        );
      }).catch(() => {
        message.error('加载收入数据失败');
      }).finally(() => setLoading(false));
    }
  }, [open, month, person]);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { key: String(Date.now()), time: dayjs().format('YYYY-MM-DD'), category: '其他', amount: 0, channel: '', account: '', note: '' },
    ]);
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((e) => e.key !== key));
  };

  const updateItem = (key: string, field: keyof IncomeItem, value: any) => {
    setItems((prev) => prev.map((e) => (e.key === key ? { ...e, [field]: value } : e)));
  };

  const handleSave = async () => {
    // Validate
    const validItems = items.filter((e) => e.amount > 0);
    if (validItems.length === 0) {
      message.warning('请至少添加一条有效的收入记录');
      return;
    }
    setSaving(true);
    try {
      await api.updateIncome(
        month,
        person,
        validItems.map((e) => ({
          time: e.time,
          category: e.category,
          amount: e.amount,
          channel: e.channel,
          account: e.account,
          note: e.note,
        }))
      );
      message.success(`${person === 'BB' ? '斌' : '纳'}的收入已保存`);
      onSaved();
      onClose();
    } catch (err: any) {
      message.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const personLabel = person === 'BB' ? '斌' : '纳';

  const columns = [
    {
      title: '日期',
      dataIndex: 'time',
      width: 120,
      render: (val: string, _: any, idx: number) => (
        <Input
          type="date"
          value={val}
          onChange={(e) => updateItem(items[idx].key, 'time', e.target.value)}
          style={{ width: 130 }}
        />
      ),
    },
    {
      title: '类别',
      dataIndex: 'category',
      width: 100,
      render: (val: string, _: any, idx: number) => (
        <Select
          value={val}
          onChange={(v) => updateItem(items[idx].key, 'category', v)}
          options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 130,
      render: (val: number, _: any, idx: number) => (
        <InputNumber
          value={val}
          onChange={(v) => updateItem(items[idx].key, 'amount', v ?? 0)}
          min={0}
          precision={2}
          prefix="¥"
          style={{ width: 130 }}
        />
      ),
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      width: 130,
      render: (val: string, _: any, idx: number) => (
        <Select
          value={val || undefined}
          onChange={(v) => updateItem(items[idx].key, 'channel', v ?? '')}
          options={CHANNEL_OPTIONS.map((c) => ({ value: c, label: c }))}
          placeholder="选择渠道"
          allowClear
          style={{ width: 120 }}
        />
      ),
    },
    {
      title: '账户',
      dataIndex: 'account',
      width: 130,
      render: (val: string, _: any, idx: number) => (
        <Input
          value={val}
          onChange={(e) => updateItem(items[idx].key, 'account', e.target.value)}
          placeholder="账户名"
          style={{ width: 120 }}
        />
      ),
    },
    {
      title: '备注',
      dataIndex: 'note',
      width: 150,
      render: (val: string, _: any, idx: number) => (
        <Input
          value={val}
          onChange={(e) => updateItem(items[idx].key, 'note', e.target.value)}
          placeholder="备注"
          style={{ width: 140 }}
        />
      ),
    },
    {
      title: '操作',
      width: 60,
      render: (_: any, __: any, idx: number) => (
        <Popconfirm title="确认删除？" onConfirm={() => removeItem(items[idx].key)}>
          <Button icon={<DeleteOutlined />} size="small" danger />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      title={`编辑 ${personLabel} 的收入`}
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      width={860}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="dashed" onClick={addItem} icon={<PlusOutlined />}>
            添加记录
          </Button>
          <Button type="primary" loading={saving} onClick={handleSave}>
            保存
          </Button>
        </Space>
      }
    >
      <Table
        dataSource={items.map((item, idx) => ({ ...item, idx }))}
        columns={columns}
        pagination={false}
        size="small"
        loading={loading}
        rowKey="key"
        scroll={{ x: 820 }}
      />
    </Modal>
  );
}
