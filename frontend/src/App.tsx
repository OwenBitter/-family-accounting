import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import DashboardPage from './pages/Dashboard';
import ImportPage from './pages/Import';
import InvestmentPage from './pages/Investment';
import NotFoundPage from './pages/NotFound';
import './styles/global.less';

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
        },
      }}
    >
      <ErrorBoundary>
        <HashRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="investment" element={<InvestmentPage />} />
              <Route path="income" element={<Navigate to="/import" replace />} />
              <Route path="analysis" element={<Navigate to="/" replace />} />
              <Route path="export" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </ErrorBoundary>
    </ConfigProvider>
  );
}
