"use client";

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Download, Upload, HardDrive, ChevronRight, FileText, Book, Bookmark,
  Receipt, Clipboard, ShieldCheck, Bell, BellOff, BellRing, LayoutTemplate,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';
import { dialogService } from '../../lib/dialogService';
import EmailSyncSection from './EmailSyncSection';
import EmailScanHistory from './EmailScanHistory';
import GmailSendSection from './GmailSendSection';
import NotificationSetupGuide from './NotificationSetupGuide';

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [backendHealth, setBackendHealth] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [backendMessage, setBackendMessage] = useState('Checking server status…');
  const { permission, loading: notifLoading, enableNotifications } = useNotifications();
  const [stats, setStats] = useState({
    journals: 0, contacts: 0, contracts: 0, samples: 0, debitNotes: 0,
  });

  useEffect(() => {
    fetchStats();
    fetchBackendHealth();
  }, []);

  const fetchBackendHealth = async () => {
    try {
      const resp = await fetch('/api/health');
      const data = await resp.json();
      if (resp.ok && data?.ok) {
        setBackendHealth('ok');
        setBackendMessage(data.zohoConfigured ? 'Backend online · Zoho mail ready' : 'Backend online · Zoho secrets needed');
      } else {
        setBackendHealth('error');
        setBackendMessage('Backend health check failed');
      }
    } catch {
      setBackendHealth('error');
      setBackendMessage('Backend not reachable');
    }
  };

  const fetchStats = async () => {
    try {
      const [j, c, ct, s, d] = await Promise.all([
        supabase.from('journal_entries').select('id', { count: 'exact', head: true }),
        supabase.from('contact_book').select('id', { count: 'exact', head: true }),
        supabase.from('contracts').select('id', { count: 'exact', head: true }),
        supabase.from('samples').select('id', { count: 'exact', head: true }),
        supabase.from('debit_notes').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        journals: j.count || 0, contacts: c.count || 0, contracts: ct.count || 0,
        samples: s.count || 0, debitNotes: d.count || 0,
      });
    } catch (err) { console.error('Error fetching stats:', err); }
  };

  const handleExportAll = async () => {
    try {
      setLoading(true);
      const tables = ['journal_entries', 'contact_book', 'contracts', 'samples', 'debit_notes'];
      const backupData: any = {};
      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        backupData[table] = data;
      }
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jild-impex-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      dialogService.alert({ title: 'Export failed', message: err?.message || 'Please try again.', tone: 'danger' });
    } finally { setLoading(false); }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const ok = await dialogService.confirm({
      title: 'Restore from backup?',
      message: 'This will merge the imported data with your existing records. Continue?',
      confirmLabel: 'Restore', tone: 'warning',
    });
    if (!ok) { event.target.value = ''; return; }
    try {
      setLoading(true);
      const text = await file.text();
      const data = JSON.parse(text);
      for (const [table, recs] of Object.entries(data)) {
        if (Array.isArray(recs) && recs.length > 0) {
          const { error } = await supabase.from(table).upsert(recs as any[]);
          if (error) console.error(`Error importing ${table}:`, error);
        }
      }
      dialogService.success('Import completed successfully!');
      fetchStats();
    } catch (err: any) {
      dialogService.alert({ title: 'Import failed', message: err?.message || 'Please check the file format.', tone: 'danger' });
    } finally { setLoading(false); event.target.value = ''; }
  };

  const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);
  const usagePercent = Math.min(Math.round((totalRecords / 5000) * 100), 100);

  const statItems = [
    { label: 'Journal',   count: stats.journals,   icon: Clipboard },
    { label: 'Contacts',  count: stats.contacts,   icon: Book },
    { label: 'Contracts', count: stats.contracts,  icon: FileText },
    { label: 'Letters',   count: stats.samples,    icon: Bookmark },
    { label: 'Payments',  count: stats.debitNotes, icon: Receipt },
  ];

  return (
    <div className="min-h-full bg-gray-50/60">
      <div className="px-4 py-6 max-w-3xl mx-auto space-y-5 page-fade-in">

        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">Mail, notifications &amp; data</p>
        </div>

        {/* ── Email ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full ${backendHealth === 'ok' ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]' : backendHealth === 'error' ? 'bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]' : 'bg-amber-400 shadow-[0_0_0_4px_rgba(245,158,11,0.12)]'}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Backend status</p>
              <p className="text-xs text-slate-500 truncate">{backendMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchBackendHealth}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors shrink-0"
          >
            Re-check
          </button>
        </div>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Zoho Mail</p>
          <div className="space-y-3">
            <EmailSyncSection />
            <GmailSendSection />
          </div>
        </section>

        {/* ── Tools ── */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Tools</p>
          <div className="space-y-3">
            <Link
              to="/app/approvals"
              className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Invoice Approvals</p>
                  <p className="text-xs text-gray-500">Review synced invoices</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-emerald-500 transition-colors" />
            </Link>

            <Link
              to="/app/settings/pdf-editor"
              className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 group-hover:bg-blue-100 transition-colors">
                  <LayoutTemplate className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">PDF Layout</p>
                  <p className="text-xs text-gray-500">Customise contract PDF fields</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </Link>

            <EmailScanHistory />
          </div>
        </section>

        {/* ── Notifications ── */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Notifications</p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${permission === 'granted' ? 'bg-blue-50' : permission === 'denied' ? 'bg-red-50' : 'bg-gray-100'}`}>
                  {permission === 'granted'
                    ? <BellRing className="h-4 w-4 text-blue-600" />
                    : permission === 'denied'
                    ? <BellOff className="h-4 w-4 text-red-500" />
                    : <Bell className="h-4 w-4 text-gray-500" />
                  }
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Push Notifications</p>
                  <p className="text-xs text-gray-500">
                    {permission === 'granted'
                      ? 'Enabled — journal reminders active'
                      : permission === 'denied'
                      ? 'Blocked in browser settings'
                      : permission === 'unsupported'
                      ? 'Not supported on this browser'
                      : 'Receive journal entry reminders'
                    }
                  </p>
                </div>
              </div>
              {permission === 'granted' ? (
                <button
                  onClick={async () => {
                    try {
                      const reg = await navigator.serviceWorker.ready;
                      await reg.showNotification('Test — JILD IMPEX', { body: 'Push notifications are working!', icon: '/icon-192.png' });
                    } catch {
                      new Notification('Test — JILD IMPEX', { body: 'Push notifications are working!', icon: '/icon-192.png' });
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl hover:bg-blue-100 transition-colors shrink-0"
                >
                  <CheckCircle2 className="h-3 w-3" /> Test
                </button>
              ) : permission === 'denied' ? (
                <span className="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-semibold rounded-full shrink-0">Blocked</span>
              ) : permission !== 'unsupported' && (
                <button
                  onClick={enableNotifications}
                  disabled={notifLoading}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm shrink-0"
                >
                  {notifLoading ? 'Enabling…' : 'Enable'}
                </button>
              )}
            </div>
            {permission === 'denied' && (
              <div className="px-4 pb-4">
                <p className="text-[11px] text-gray-500 bg-gray-50 rounded-xl p-3 leading-relaxed">
                  To unblock: tap the <strong>lock icon</strong> in your browser address bar → Site settings → Notifications → Allow. Then reload and tap Enable.
                </p>
              </div>
            )}
          </div>
          <div className="mt-3">
            <NotificationSetupGuide />
          </div>
        </section>

        {/* ── Data & backup ── */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Data</p>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-3">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <HardDrive className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-bold text-gray-900">Storage</p>
                <span className="ml-auto text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">
                  {totalRecords} records
                </span>
              </div>
              <div className="flex justify-between items-end mb-2">
                <p className="text-2xl font-black text-gray-900">{usagePercent}%</p>
                <p className="text-[10px] text-gray-400">of 5,000 limit</p>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-blue-600'}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
            <div className="px-3 pb-3 grid grid-cols-5 gap-1.5">
              {statItems.map(item => (
                <div key={item.label} className="text-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-lg font-black text-slate-900">{item.count}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExportAll}
              disabled={loading}
              className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all group disabled:opacity-50"
            >
              <div className="p-2.5 bg-blue-50 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                <Download className="h-4 w-4" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-bold text-gray-900">Backup</p>
                <p className="text-[10px] text-gray-400">Download JSON</p>
              </div>
            </button>
            <label className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group cursor-pointer">
              <div className="p-2.5 bg-emerald-50 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                <Upload className="h-4 w-4" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-bold text-gray-900">Restore</p>
                <p className="text-[10px] text-gray-400">Import backup</p>
              </div>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={loading} />
            </label>
          </div>
        </section>

      </div>
    </div>
  );
};

export default SettingsPage;
