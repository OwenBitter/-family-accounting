import { Card, Statistic } from 'antd';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  value: number | string;
  prefix?: ReactNode;
  suffix?: string;
  precision?: number;
  color?: string;
  loading?: boolean;
}

export default function StatCard({ title, value, prefix, suffix, precision = 2, color, loading }: Props) {
  return (
    <Card className="stat-card" loading={loading}>
      <Statistic
        title={title}
        value={value}
        prefix={prefix}
        suffix={suffix}
        precision={precision}
        valueStyle={{ color }}
      />
    </Card>
  );
}
