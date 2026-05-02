"use client";

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/Auth/LoginPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import NotificationInitializer from './components/Auth/NotificationInitializer';
import LoadingScreen from './components/UI/LoadingScreen';
import DialogProvider from './components/UI/DialogProvider';
import Layout from './components/Layout/Layout';
import HomePage from './components/Home/HomePage';
import ContractsPage from './components/Contracts/ContractsPage';
import ContactBookPage from './components/ContactBook/ContactBookPage';
import DebitNotePage from './components/DebitNote/DebitNotePage';
import SampleBookPage from './components/SampleBook/SampleBookPage';
import SettingsPage from './components/Settings/SettingsPage';
import ApprovalsPage from './components/Approvals/ApprovalsPage';
import EmailTemplatesPage from './components/EmailTemplates/EmailTemplatesPage';
import { useAuth } from './hooks/useAuth';

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
