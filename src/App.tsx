"use client";

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import HomePage from './components/Home/HomePage';
import ContractsPage from './components/Contracts/ContractsPage';
import ContactBookPage from './components/ContactBook/ContactBookPage';
import DebitNotePage from './components/DebitNote/DebitNotePage';
import SampleBookPage from './components/SampleBook/SampleBookPage';
import SettingsPage from './components/Settings/SettingsPage';
import LoginPage from './components/Auth/LoginPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';

function App() {
  return (
    <Router>
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
          <Route path="debit-notes" element={<DebitNotePage />} />
          <Route path="debit-notes/:id" element={<DebitNotePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/app/home" replace />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;