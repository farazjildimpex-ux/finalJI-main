"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Database, Download, Upload, AlertCircle, HardDrive, Trash2,
  ChevronDown, ChevronUp, ChevronRight, FileText, Book, Bookmark,
  Receipt, Clipboard, Search, RefreshCw, CheckCircle2, ShieldCheck,
  Bell, BellOff, BellRing,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';
import { dialogService } from '../../lib/dialogService';
import EmailSyncSection from './EmailSyncSection';
import EmailScanHistory from './EmailScanHistory';
import GmailSendSection from './GmailSendSection';

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { permission, loading: notifLoading, enableNotifications } = useNotifications();
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    journals: 0, contacts: 0, contracts: 0, samples: 0, debitNotes: 0,
  });

  useEffect(() => { fetchStats(); }, []);

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

  const fetchRecords = async (table: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setRecords(data || []);
    } catch (err) { console.error('Error fetching records:', err); }
    finally { setLoading(false); }
  };

  const toggleExpand = (table: string) => {
    if (expandedTable === table) { setExpandedTable(null); setRecords([]); setSearchTerm(''); }
    else { setExpandedTable(table); setSearchTerm(''); fetchRecords(table); }
  };

  const deleteRecord = async (table: string, id: string) => {
    const ok = await dialogService.confirm({
      title: 'Delete record?', message: 'This cannot be undone.', confirmLabel: 'Delete', tone: 'danger',
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      setRecords(records.filter(r => r.id !== id));
      fetchStats();
      dialogService.success('Record deleted.');
    } catch (err: any) {
      dialogService.alert({ title: 'Delete failed', message: err?.message || 'Please try again.', tone: 'danger' });
    }
  };

  const filteredRecords = useMemo(() => {
    if (!searchTerm) return records;
    const lc = searchTerm.toLowerCase();
    return records.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(lc)));
  }, [records, searchTerm]);

  const totalRecords  = Object.values(stats).reduce((a, b) => a + b, 0);
  const usagePercent  = Math.min(Math.round((totalRecords / 5000) * 100), 100);

  const tables = [
    { label: 'Journal Entries', table: 'journal_entries', key: 'journals',   icon: Clipboard, displayField: 'title',        subField: 'entry_date' },
    { label: 'Contact Book',    table: 'contact_book',    key: 'contacts',   icon: Book,      displayField: 'name',          subField: 'mark' },
    { label: 'Contracts',       table: 'contracts',       key: 'contracts',  icon: FileText,  displayField: 'contract_no',   subField: 'supplier_name' },
    { label: 'Letters',         table: 'samples',         key: 'samples',    icon: Bookmark,  displayField: 'sample_number', subField: 'supplier_name' },
    { label: 'Payments',        table: 'debit_notes',     key: 'debitNotes', icon: Receipt,   displayField: 'debit_note_no', subField: 'supplier_name' },
  ];

  return (
    <div className="min-h-full bg-gray-50/60">
      <div className="px-4 py-6 max-w-3xl mx-auto space-y-4 page-fade-in">

        {/* ── Page header ── */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500 mb-1">Configuration</p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">Email, data management &amp; system tools</p>
        </div>

        {/* ── Email section label ── */}
        <div className="pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Email — office@jildimpex.com</p>
          <div className="space-y-3">
            <EmailSyncSection />
            <GmailSendSection />
          </div>
        </div>

        {/* ── Invoice approvals link ── */}
        <Link
          to="/app/approvals"
          className="flex items-center justify-between p-4 bg-white rounded-3xl border border-gray-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Invoice Approvals</p>
              <p className="text-xs text-gray-500">Review synced invoices · approve to lock them from overwrites</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-emerald-500 transition-colors" />
        </Link>

        {/* ── Scan history ── */}
        <EmailScanHistory />

        {/* ── Push notifications ── */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${permission === 'granted' ? 'bg-blue-50' : permission === 'denied' ? 'bg-red-50' : 'bg-gray-100'}`}>
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
                    ? 'Enabled — you will receive journal reminders and alerts'
                    : permission === 'denied'
                    ? 'Blocked — allow in browser settings to enable'
                    : permission === 'unsupported'
                    ? 'Not supported on this browser'
                    : 'Receive reminders for journal entries on your device'
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
                <CheckCircle2 className="h-3 w-3" /> On · Test
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
              <p className="text-[11px] text-gray-500 bg-gray-50 rounded-2xl p-3 leading-relaxed">
                To unblock: tap the <strong>lock icon</strong> in your browser address bar → Site settings → Notifications → Allow. Then reload the page and tap Enable.
              </p>
            </div>
          )}
        </div>

        {/* ── Data section label ── */}
        <div className="pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Data &amp; Storage</p>

          {/* Storage health */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-bold text-gray-900">Storage</p>
                </div>
                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-full">
                  <ShieldCheck className="h-2.5 w-2.5" /> Secure
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Database usage</p>
                    <p className="text-2xl font-black text-gray-900 mt-0.5">{usagePercent}%</p>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">{totalRecords} / 5,000 records</span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-blue-600'}`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="p-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
              {tables.map(item => (
                <div key={item.label} className="text-center p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-xl font-black text-slate-900">{stats[item.key as keyof typeof stats]}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Backup & restore ── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExportAll}
            disabled={loading}
            className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-3xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all group disabled:opacity-50"
          >
            <div className="p-2.5 bg-blue-50 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
              <Download className="h-4 w-4" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-bold text-gray-900">Backup</p>
              <p className="text-[10px] text-gray-400">Download JSON</p>
            </div>
          </button>
          <label className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-3xl shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group cursor-pointer">
            <div className="p-2.5 bg-emerald-50 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
              <Upload className="h-4 w-4" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-bold text-gray-900">Restore</p>
              <p className="text-[10px] text-gray-400">Import backup</p>
            </div>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={loading} />
          </label>
        </div>

        {/* ── Maintenance tools ── */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Maintenance</p>
          <div className="space-y-2">
            {tables.map(item => (
              <div key={item.table} className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleExpand(item.table)}
                  className={`w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${expandedTable === item.table ? 'bg-blue-50/30' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-2xl transition-colors ${expandedTable === item.table ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-400">{stats[item.key as keyof typeof stats]} entries</p>
                    </div>
                  </div>
                  {expandedTable === item.table
                    ? <ChevronUp className="h-4 w-4 text-blue-600" />
                    : <ChevronDown className="h-4 w-4 text-gray-400" />
                  }
                </button>

                {expandedTable === item.table && (
                  <div className="border-t border-gray-100">
                    <div className="p-3 bg-slate-50/50 border-b border-gray-100">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder={`Search ${item.label.toLowerCase()}…`}
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                      {loading ? (
                        <div className="p-8 text-center">
                          <RefreshCw className="h-5 w-5 text-blue-600 animate-spin mx-auto mb-2" />
                          <p className="text-xs text-gray-400">Loading…</p>
                        </div>
                      ) : filteredRecords.length === 0 ? (
                        <div className="p-8 text-center">
                          <p className="text-xs text-gray-400">No records found</p>
                        </div>
                      ) : filteredRecords.map(record => (
                        <div key={record.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 group">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-900 truncate">{record[item.displayField] || 'Untitled'}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] text-gray-400">{record[item.subField] || '—'}</p>
                              <span className="h-0.5 w-0.5 bg-gray-300 rounded-full" />
                              <p className="text-[10px] text-gray-400">{new Date(record.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); deleteRecord(item.table, record.id); }}
                            className="ml-3 p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Safety warning ── */}
        <div className="p-4 bg-amber-50 rounded-3xl border border-amber-100 flex items-start gap-3">
          <div className="p-1.5 bg-amber-100 rounded-xl shrink-0">
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-xs text-amber-900">
            <p className="font-bold mb-1">Safety notice</p>
            <p className="leading-relaxed opacity-80">
              Deleting records here is permanent and cannot be undone. This tool is designed for system maintenance. Please ensure you have a backup before removing data.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;
