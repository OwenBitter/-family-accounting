import { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, Button, Space, Input, Divider, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import * as api from '../api';
import type { AssetData } from '../types';

interface Props {
  open: boolean;
  asset: AssetData | null;
  month: string;
  onClose: () => void;
  onSaved: () => void;
}

interface BankEntry {
  key: string;
  name: string;
  amount: number;
}

interface OtherEntry {
  key: string;
  name: string;
  amount: number;
}

export default function AssetEditModal({ open, asset, month, onClose, onSaved }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const [bankEntries, setBankEntries] = useState<BankEntry[]>([]);
  const [otherEntries, setOtherEntries] = useState<OtherEntry[]>([]);

  useEffect(() => {
    if (open && asset) {
      form.setFieldsValue({
        alipay_fund: asset.alipayFund ?? 0,
        alipay_yuebao: asset.alipayYuebao ?? 0,
        alipay_balance: asset.alipayBalance ?? 0,
        wechat_balance: asset.wechatBalance ?? 0,
        wechat_licaitong: asset.wechatLicaitong ?? 0,
        loan_receivable: 0,
      });
      setBankEntries(
        Object.entries(asset.bankAccounts ?? {})
          .filter(([k]) => k !== '总额')
          .map(([name, amount], i) => ({ key: String(i), name, amount }))
      );
      setOtherEntries(
        Object.entries(asset.other ?? {}).map(([name, amount], i) => ({ key: String(i), name, amount }))
      );
    }
  }, [open, asset, form]);

  const addBank = () => {
    setBankEntries((prev) => [...prev, { key: String(Date.now()), name: '', amount: 0 }]);
  };

  const removeBank = (key: string) => {
    setBankEntries((prev) => prev.filter((e) => e.key !== key));
  };

  const updateBank = (key: string, field: 'name' | 'amount', value: string | number) => {
    setBankEntries((prev) => prev.map((e) => (e.key === key ? { ...e, [field]: value } : e)));
  };

  const addOther = () => {
    setOtherEntries((prev) => [...prev, { key: String(Date.now()), name: '', amount: 0 }]);
  };

  const removeOther = (key: string) => {
    setOtherEntries((prev) => prev.filter((e) => e.key !== key));
  };

  const updateOther = (key: string, field: 'name' | 'amount', value: string | number) => {
    setOtherEntries((prev) => prev.map((e) => (e.key === key ? { ...e, [field]: value } : e)));
  };

  const handleSave = async () => {
    if (!asset) return;
    try {
      const values = await form.validateFields();
      setSaving(true);

      const bankAccounts: Record<string, number> = {};
      bankEntries.forEach((e) => {
        if (e.name.trim()) bankAccounts[e.name.trim()] = e.amount;
      });

      const other: Record<string, number> = {};
      otherEntries.forEach((e) => {
        if (e.name.trim()) other[e.name.trim()] = e.amount;
      });

      await api.updateAssets(month, asset.person, {
        ...values,
        bank_accounts: bankAccounts,
        other,
      });

      message.success(`${asset.person === 'BB' ? '斌' : '纳'}的资产已保存`);
      onSaved();
      onClose();
    } catch (err: any) {
      message.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!asset) return null;

  return (
    <Modal
      title={`编辑 ${asset.person === 'BB' ? '斌' : '纳'} 的资产`}
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      width={520}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="基金" name="alipay_fund">
          <InputNumber style={{ width: '100%' }} min={0} precision={2} />
        </Form.Item>
        <Form.Item label="余额宝" name="alipay_yuebao">
          <InputNumber style={{ width: '100%' }} min={0} precision={2} />
        </Form.Item>
        <Form.Item label="余额（支付宝）" name="alipay_balance">
          <InputNumber style={{ width: '100%' }} min={0} precision={2} />
        </Form.Item>
        <Form.Item label="零钱（微信）" name="wechat_balance">
          <InputNumber style={{ width: '100%' }} min={0} precision={2} />
        </Form.Item>
        <Form.Item label="零钱通（微信）" name="wechat_licaitong">
          <InputNumber style={{ width: '100%' }} min={0} precision={2} />
        </Form.Item>

        <Divider orientation="left" style={{ fontSize: 13 }}>银行卡</Divider>
        {bankEntries.map((entry) => (
          <Space key={entry.key} style={{ width: '100%', marginBottom: 8 }}>
            <Input
              placeholder="银行名称"
              value={entry.name}
              onChange={(e) => updateBank(entry.key, 'name', e.target.value)}
              style={{ width: 140 }}
            />
            <InputNumber
              placeholder="金额"
              value={entry.amount}
              onChange={(v) => updateBank(entry.key, 'amount', v ?? 0)}
              min={0}
              precision={2}
              style={{ flex: 1 }}
            />
            <Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeBank(entry.key)} />
          </Space>
        ))}
        <Button type="dashed" onClick={addBank} icon={<PlusOutlined />} block size="small">
          添加银行卡
        </Button>

        <Divider orientation="left" style={{ fontSize: 13, marginTop: 20 }}>其他资产</Divider>
        {otherEntries.map((entry) => (
          <Space key={entry.key} style={{ width: '100%', marginBottom: 8 }}>
            <Input
              placeholder="名称"
              value={entry.name}
              onChange={(e) => updateOther(entry.key, 'name', e.target.value)}
              style={{ width: 140 }}
            />
            <InputNumber
              placeholder="金额"
              value={entry.amount}
              onChange={(v) => updateOther(entry.key, 'amount', v ?? 0)}
              min={0}
              precision={2}
              style={{ flex: 1 }}
            />
            <Button icon={<DeleteOutlined />} size="small" danger onClick={() => removeOther(entry.key)} />
          </Space>
        ))}
        <Button type="dashed" onClick={addOther} icon={<PlusOutlined />} block size="small">
          添加其他资产
        </Button>
      </Form>
    </Modal>
  );
}
