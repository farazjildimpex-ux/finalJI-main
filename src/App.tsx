"use client";

import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import HomePage from './components/Home/HomePage';
import ContractsPage from './components/Contracts/ContractsPage';
import ContactBookPage from './components/ContactBook/ContactBookPage';
import DebitNotePage from './components/DebitNote/DebitNotePage';
import SampleBookPage from './components/SampleBook/SampleBookPage';
import SettingsPage from './components/Settings/SettingsPage';
import ApprovalsPage from './components/Approvals/ApprovalsPage';
import EmailTemplatesPage from './components/EmailTemplates/EmailTemplatesPage';
import LoginPage from './components/Auth/LoginPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import NotificationInitializer from './components/Auth/NotificationInitializer';
import LoadingScreen from './components/UI/LoadingScreen';
import DialogProvider from './components/UI/DialogProvider';
import { useAuth } from './hooks/useAuth';

// Minimum time (ms) the JI splash animation is shown. The animation itself
// runs ~1.0s, so we hold for 1200ms so users always see it play through —
// even when the app loads from cache and auth resolves instantly.
const SPLASH_MIN_DURATION_MS = 1200;

function App() {
  const { loading } = useAuth();
  const [splashElapsed, setSplashElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashElapsed(true), SPLASH_MIN_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  if (loading || !splashElapsed) {
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
    </Router>
    </DialogProvider>
  );
}

export default App;