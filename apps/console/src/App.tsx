import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Shell } from './components/layout/Shell';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { InboxPage } from './pages/InboxPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { LiveChatPage } from './pages/LiveChatPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AdminPage } from './pages/AdminPage';
import { RosterPage } from './pages/RosterPage';
import { DbExplorerPage } from './pages/DbExplorerPage';

import './styles/theme.css';
import './styles/layout.css';
import './styles/components.css';

import { ToastProvider } from './context/ToastContext';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/password/reset" element={<ResetPasswordPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/register/join" element={<RegisterPage />} />
              <Route path="/db" element={<DbExplorerPage />} />

              {/* Authenticated Workspace */}
              <Route element={<Shell />}>
                <Route path="/" element={<Navigate to="/inbox" replace />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route path="/tickets" element={<InboxPage />} />
                <Route path="/tickets/:id" element={<TicketDetailPage />} />
                <Route path="/chat" element={<LiveChatPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/roster" element={<RosterPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/inbox" replace />} />
            </Routes>
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};
