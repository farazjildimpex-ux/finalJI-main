"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Database, Download, Upload, AlertCircle, HardDrive, Trash2, ChevronDown, ChevronUp, FileText, Book, Bookmark, Receipt, Clipboard, Search, RefreshCw, CheckCircle2, ShieldCheck, Bell, BellOff, BellRing } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useNotifications } from '../../hooks/useNotifications';

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { permission, loading: notifLoading, enableNotifications } = useNotifications();
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    journals: 0,
    contacts: 0,
    contracts: 0,
    samples: 0,
    debitNotes: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [j, c, ct, s, d] = await Promise.all([
        supabase.from('journal_entries').select('id', { count: 'exact', head: true }),
        supabase.from('contact_book').select('id', { count: 'exact', head: true }),
        supabase.from('contracts').select('id', { count: 'exact', head: true }),
        supabase.from('samples').select('id', { count: 'exact', head: true }),
        supabase.from('debit_notes').select('id', { count: 'exact', head: true })
      ]);

      setStats({
        journals: j.count || 0,
        contacts: c.count || 0,
        contracts: ct.count || 0,
        samples: s.count || 0,
        debitNotes: d.count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
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
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('This will merge the imported data with your existing records. Continue?')) return;

    try {
      setLoading(true);
      const text = await file.text();
      const data = JSON.parse(text);

      for (const [table, records] of Object.entries(data)) {
        if (Array.isArray(records) && records.length > 0) {
          const { error } = await supabase.from(table).upsert(records);
          if (error) console.error(`Error importing ${table}:`, error);
        }
      }

      alert('Import completed successfully!');
      fetchStats();
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please check the file format.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const fetchRecords = async (table: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (table: string) => {
    if (expandedTable === table) {
      setExpandedTable(null);
      setRecords([]);
      setSearchTerm('');
    } else {
      setExpandedTable(table);
      setSearchTerm('');
      fetchRecords(table);
    }
  };

  const deleteRecord = async (table: string, id: string) => {
    if (!confirm('Are you sure you want to delete this record? This cannot be undone.')) return;
    
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      
      setRecords(records.filter(r => r.id !== id));
      fetchStats();
    } catch (error) {
      alert('Delete failed. Please try again.');
    }
  };

  const filteredRecords = useMemo(() => {
    if (!searchTerm) return records;
    const lowerSearch = searchTerm.toLowerCase();
    return records.filter(r => 
      Object.values(r).some(val => 
        String(val).toLowerCase().includes(lowerSearch)
      )
    );
  }, [records, searchTerm]);

  const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);
  const usagePercent = Math.min(Math.round((totalRecords / 5000) * 100), 100);

  const tables = [
    { label: 'Journal Entries', table: 'journal_entries', key: 'journals', icon: Clipboard, displayField: 'title', subField: 'entry_date' },
    { label: 'Contact Book', table: 'contact_book', key: 'contacts', icon: Book, displayField: 'name', subField: 'mark' },
    { label: 'Contracts', table: 'contracts', key: 'contracts', icon: FileText, displayField: 'contract_no', subField: 'supplier_name' },
    { label: 'Letters (Samples)', table: 'samples', key: 'samples', icon: Bookmark, displayField: 'sample_number', subField: 'supplier_name' },
    { label: 'Payments', table: 'debit_notes', key: 'debitNotes', icon: Receipt, displayField: 'debit_note_no', subField: 'supplier_name' }
  ];

  return (
    <div className="p-2 md:p-3 max-w-5xl mx-auto space-y-4 page-fade-in">
      <div className="mb-4 md:mb-6 flex flex-col items-center text-center">
        <div className="flex items-center justify-center mb-2">
          <Database className="h-6 w-6 md:h-8 md:w-8 text-blue-600 mr-2" />
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Data Management</h1>
        </div>
        <p className="text-xs md:text-sm text-gray-600">System health and record maintenance</p>
      </div>

      {/* Push Notifications */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 flex items-center justify-between">
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
              <p className="text-[10px] text-gray-500 font-medium">
                {permission === 'granted'
                  ? 'Enabled — you will receive journal reminders and alerts'
                  : permission === 'denied'
                  ? 'Blocked — allow in browser site settings to enable'
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
                  await reg.showNotification('Test — JILD IMPEX', {
                    body: 'Push notifications are working correctly!',
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                  });
                } catch {
                  new Notification('Test — JILD IMPEX', {
                    body: 'Push notifications are working correctly!',
                    icon: '/icon-192.png',
                  });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase rounded-xl tracking-widest hover:bg-blue-100 transition-colors"
            >
              <CheckCircle2 className="h-3 w-3" /> On · Test
            </button>
          ) : permission === 'denied' ? (
            <span className="px-2.5 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded-full tracking-widest">
              Blocked
            </span>
          ) : permission !== 'unsupported' && (
            <button
              onClick={enableNotifications}
              disabled={notifLoading}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm shadow-blue-100"
            >
              {notifLoading ? 'Enabling…' : 'Enable'}
            </button>
          )}
        </div>
        {permission === 'denied' && (
          <div className="px-4 pb-4">
            <p className="text-[11px] text-gray-500 bg-gray-50 rounded-2xl p-3 leading-relaxed">
              To unblock: tap the <strong>lock icon</strong> in your browser address bar → Site settings → Notifications → Allow.
              Then reload the page and tap Enable.
            </p>
          </div>
        )}
      </div>

      {/* Backup & Restore Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={handleExportAll}
          disabled={loading}
          className="flex items-center justify-center gap-3 p-4 bg-white border border-blue-100 rounded-3xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
        >
          <div className="p-2.5 bg-blue-50 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Download className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-900">Backup Data</p>
            <p className="text-[10px] text-gray-500">Download all records as JSON</p>
          </div>
        </button>

        <label className="flex items-center justify-center gap-3 p-4 bg-white border border-emerald-100 rounded-3xl shadow-sm hover:shadow-md hover:border-emerald-300 transition-all group cursor-pointer">
          <div className="p-2.5 bg-emerald-50 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <Upload className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-900">Restore Data</p>
            <p className="text-[10px] text-gray-500">Import records from backup file</p>
          </div>
          <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={loading} />
        </label>
      </div>

      {/* Usage Section */}
      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-br from-slate-50 to-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-900">Storage Health</h2>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-100 text-green-700 text-[9px] font-black uppercase rounded-full">
              <ShieldCheck className="h-2.5 w-2.5" />
              Secure
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Database Usage</p>
                <p className="text-2xl font-black text-gray-900">{usagePercent}%</p>
              </div>
              <p className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">
                {totalRecords} / 5,000 Records
              </p>
            </div>
            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-blue-600'
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {tables.map((item) => (
            <div key={item.label} className="text-center p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors group">
              <p className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                {stats[item.key as keyof typeof stats]}
              </p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Records Management */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-900 px-1 flex items-center gap-2">
          Maintenance Tools
          <span className="h-1 w-1 bg-gray-300 rounded-full" />
          <span className="text-[10px] font-normal text-gray-500">Quick delete & search</span>
        </h2>
        
        <div className="grid grid-cols-1 gap-3">
          {tables.map((item) => (
            <div key={item.table} className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm transition-all">
              <div 
                className={`p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors ${expandedTable === item.table ? 'bg-blue-50/30' : ''}`}
                onClick={() => toggleExpand(item.table)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl transition-colors ${expandedTable === item.table ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{item.label}</p>
                    <p className="text-[10px] text-gray-500 font-medium">{stats[item.key as keyof typeof stats]} total entries</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {expandedTable === item.table ? <ChevronUp className="h-4 w-4 text-blue-600" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </div>

              {expandedTable === item.table && (
                <div className="border-t border-gray-100 bg-white">
                  <div className="p-3 bg-slate-50/50 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder={`Search ${item.label.toLowerCase()}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-50">
                    {loading ? (
                      <div className="p-8 text-center">
                        <RefreshCw className="h-6 w-6 text-blue-600 animate-spin mx-auto mb-2" />
                        <p className="text-xs text-gray-500 font-medium">Loading records...</p>
                      </div>
                    ) : filteredRecords.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-xs text-gray-400 font-medium">No records found</p>
                      </div>
                    ) : (
                      filteredRecords.map((record) => (
                        <div key={record.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-900 truncate">
                              {record[item.displayField] || 'Untitled Record'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[9px] text-gray-400 uppercase font-black tracking-tighter">
                                {record[item.subField] || 'No Detail'}
                              </p>
                              <span className="h-1 w-1 bg-gray-200 rounded-full" />
                              <p className="text-[9px] text-gray-400 font-bold">
                                {new Date(record.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteRecord(item.table, record.id); }}
                            className="ml-3 p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            title="Quick Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-amber-50 rounded-3xl border border-amber-100 flex items-start gap-3 shadow-sm">
        <div className="p-1.5 bg-amber-100 rounded-xl">
          <AlertCircle className="h-4 w-4 text-amber-600" />
        </div>
        <div className="text-xs text-amber-900">
          <p className="font-black uppercase tracking-widest text-[9px] mb-0.5">Safety Warning</p>
          <p className="font-medium leading-relaxed opacity-80">
            Deleting records here is permanent. This tool is designed for system maintenance and clearing old data. 
            Please ensure you have backups if the data is still needed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;