import { useState } from 'react';
import { Button, Card, Select, message, Space, Alert } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import * as api from '../../api';
import { useAppStore } from '../../store/useAppStore';

export default function ExportPage() {
  const availableMonths = useAppStore((s) => s.availableMonths);
  const [month, setMonth] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!month) {
      message.error('请选择月份');
      return;
    }
    setLoading(true);
    try {
      await api.exportMonth(month);
      message.success('下载成功');
    } catch (err: any) {
      message.error(err.message || '下载失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header"><h2>导出 Excel</h2></div>

      <Card className="chart-card">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 8, color: '#a0a0a0' }}>选择月份</div>
            <Select
              value={month || undefined}
              onChange={setMonth}
              options={availableMonths.map((m) => ({ value: m, label: m }))}
              placeholder="选择要导出的月份"
              style={{ width: 240 }}
            />
          </div>

          {month && (
            <Alert type="info" showIcon message={`将导出 ${month} 的记账 Excel 文件`} />
          )}

          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            loading={loading}
            disabled={!month}
            onClick={handleExport}
          >
            下载 Excel
          </Button>
        </Space>
      </Card>
    </div>
  );
}
