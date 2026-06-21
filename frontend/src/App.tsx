import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/global.less';

const DashboardPage = lazy(() => import('./pages/Dashboard'));
const ImportPage = lazy(() => import('./pages/Import'));
const InvestmentPage = lazy(() => import('./pages/Investment'));
const NotFoundPage = lazy(() => import('./pages/NotFound'));

const Loading = () => <Spin><div style={{ height: '80vh' }} /></Spin>;

// Animal Island UI 主题色
const ANIMAL_THEME = {
  token: {
    colorPrimary: '#19c8b9',
    colorPrimaryHover: '#3dd4c6',
    colorPrimaryActive: '#50B9AB',
    colorPrimaryBg: '#e6f9f6',
    colorSuccess: '#6fba2c',
    colorWarning: '#f5c31c',
    colorError: '#e05a5a',
    colorInfo: '#19c8b9',
    colorText: '#794f27',
    colorTextSecondary: '#9f927d',
    colorTextTertiary: '#c4b89e',
    colorBgContainer: '#f8f8f0',
    colorBgElevated: '#fff',
    colorBgLayout: '#f0e8d8',
    colorBorder: '#aaa69d',
    colorBorderSecondary: '#e8e2d6',
    borderRadius: 18,
    borderRadiusLG: 24,
    borderRadiusSM: 16,
    fontFamily: 'Nunito, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
    colorLink: '#19c8b9',
    colorLinkHover: '#3dd4c6',
  },
};

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={ANIMAL_THEME}
    >
      <ErrorBoundary>
        <HashRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="import" element={<ImportPage />} />
                <Route path="investment" element={<InvestmentPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </HashRouter>
      </ErrorBoundary>
    </ConfigProvider>
  );
}
