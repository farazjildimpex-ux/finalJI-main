"use client";

import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/Auth/LoginPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import NotificationInitializer from './components/Auth/NotificationInitializer';
import LoadingScreen from './components/UI/LoadingScreen';
import DialogProvider from './components/UI/DialogProvider';
import ErrorBoundary from './components/UI/ErrorBoundary';
import { useAuth } from './hooks/useAuth';

const Layout = lazy(() => import('./components/Layout/Layout'));
const HomePage = lazy(() => import('./components/Home/HomePage'));
const ContractsPage = lazy(() => import('./components/Contracts/ContractsPage'));
const ContactBookPage = lazy(() => import('./components/ContactBook/ContactBookPage'));
const DebitNotePage = lazy(() => import('./components/DebitNote/DebitNotePage'));
const SampleBookPage = lazy(() => import('./components/SampleBook/SampleBookPage'));
const SettingsPage = lazy(() => import('./components/Settings/SettingsPage'));
const ApprovalsPage = lazy(() => import('./components/Approvals/ApprovalsPage'));
const EmailTemplatesPage = lazy(() => import('./components/EmailTemplates/EmailTemplatesPage'));

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <DialogProvider>
        <LoadingScreen />
      </DialogProvider>
    );
  }

  return (
    <DialogProvider>
      <Router>
        <NotificationInitializer />
        <ErrorBoundary>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/app/home" />} />
                <Route path="home" element={<HomePage />} />
                <Route path="contracts/:id" element={<ContractsPage />} />
                <Route path="contracts" element={<ContractsPage />} />
                <Route path="contacts" element={<ContactBookPage />} />
                <Route path="samples" element={<SampleBookPage />} />
                <Route path="samples/:id" element={<SampleBookPage />} />
                <Route path="approvals" element={<ApprovalsPage />} />
                <Route path="debit-notes" element={<DebitNotePage />} />
                <Route path="debit-notes/:id" element={<DebitNotePage />} />
                <Route path="email-templates" element={<EmailTemplatesPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/app/home" replace />} />
              </Route>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Router>
    </DialogProvider>
  );
}

export default App;
