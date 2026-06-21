import { Card, Statistic, Tag, Tooltip } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  value: number | string;
  prefix?: ReactNode;
  suffix?: string;
  precision?: number;
  color?: string;
  loading?: boolean;
  warning?: string; // 若传入，显示警告提示
}

export default function StatCard({ title, value, prefix, suffix, precision = 2, color, loading, warning }: Props) {
  return (
    <Card className="stat-card" loading={loading}>
      <Statistic
        title={warning ? (
          <span>
            {title}
            <Tooltip title={warning}>
              <Tag color="warning" style={{ marginLeft: 6, cursor: 'pointer', fontSize: 11, lineHeight: '18px' }}>
                <WarningOutlined /> 注意
              </Tag>
            </Tooltip>
          </span>
        ) : title}
        value={value}
        prefix={prefix}
        suffix={suffix}
        precision={precision}
        valueStyle={{ color }}
      />
    </Card>
  );
}
