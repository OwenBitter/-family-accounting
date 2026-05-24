import { useEffect, useState } from 'react';
import { Layout, Menu, Spin } from 'antd';
import {
  DashboardOutlined,
  ImportOutlined,
  AccountBookOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '总览' },
  { key: '/import', icon: <ImportOutlined />, label: '导入数据' },
  { key: '/investment', icon: <AccountBookOutlined />, label: '投资' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const fetchAvailableMonths = useAppStore((s) => s.fetchAvailableMonths);
  const globalLoading = false; // could wire up later

  useEffect(() => {
    fetchAvailableMonths();
  }, [fetchAvailableMonths]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ background: '#1f1f1f' }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#e5e5e5',
          fontSize: collapsed ? 16 : 20,
          fontWeight: 700,
          borderBottom: '1px solid #303030',
        }}>
          {collapsed ? '📒' : '家庭记账'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Content style={{ padding: 24, background: '#141414' }}>
          <Spin spinning={globalLoading}>
            <Outlet />
          </Spin>
        </Content>
      </Layout>
    </Layout>
  );
}
