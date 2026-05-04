import React, { useState } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Lead } from '../../types';
import { dialogService } from '../../lib/dialogService';

interface LeadImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadsImported: () => void;
}

type Source = 'leatherworkinggroup' | 'lineapelle' | 'aplf' | 'csv';

const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white transition-colors';

const LeadImportModal: React.FC<LeadImportModalProps> = ({
  isOpen, onClose, onLeadsImported
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Source>('csv');
  const [importResults, setImportResults] = useState<{ success: number; errors: string[]; total: number } | null>(null);

  const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    return user.id;
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      dialogService.alert({ title: 'Invalid file type', message: 'Please select a CSV file.', tone: 'warning' });
      return;
    }

    try {
      setLoading(true);
      setImportResults(null);

      const userId = await getUserId();
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        dialogService.alert({ title: 'Invalid CSV', message: 'CSV must have at least a header row and one data row.', tone: 'warning' });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      const required = ['company_name', 'contact_person', 'email'];
      const missing  = required.filter(h => !headers.includes(h));
      if (missing.length) {
        dialogService.alert({ title: 'Missing columns', message: `Required: ${missing.join(', ')}`, tone: 'warning' });
        return;
      }

      const leads: Partial<Lead>[] = [];
      const errors: string[] = [];

      lines.slice(1).forEach((line, i) => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const lead: Partial<Lead> = { source: 'manual', status: 'new', address: [], tags: [], user_id: userId } as any;

        headers.forEach((h, j) => {
          const v = values[j] || '';
          switch (h) {
            case 'company_name':    lead.company_name = v; break;
            case 'contact_person':  lead.contact_person = v; break;
            case 'email':           lead.email = v; break;
            case 'phone':           lead.phone = v; break;
            case 'website':         lead.website = v; break;
            case 'country':         lead.country = v; break;
            case 'industry_focus':  lead.industry_focus = v; break;
            case 'company_size':    lead.company_size = v; break;
            case 'notes':           lead.notes = v; break;
            case 'address':         lead.address = v ? [v] : []; break;
          }
        });

        if (!lead.company_name || !lead.contact_person || !lead.email) {
          errors.push(`Row ${i + 2}: Missing required fields`);
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email!)) {
          errors.push(`Row ${i + 2}: Invalid email — ${lead.email}`);
          return;
        }
        leads.push(lead);
      });

      let successCount = 0;
      for (const lead of leads) {
        const { error } = await supabase.from('leads').insert([lead]);
        if (error) {
          errors.push(error.code === '23505' ? `Duplicate: ${lead.email}` : `${lead.company_name}: ${error.message}`);
        } else {
          successCount++;
        }
      }

      setImportResults({ success: successCount, errors, total: leads.length });
      if (successCount > 0) onLeadsImported();
    } catch (error: any) {
      console.error('CSV import error:', error);
      dialogService.alert({ title: 'Import failed', message: error?.message || 'Please try again.', tone: 'danger' });
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const handleWebImport = async (source: 'leatherworkinggroup' | 'lineapelle' | 'aplf') => {
    setLoading(true);
    setImportResults(null);

    try {
      const userId = await getUserId();
      await new Promise(r => setTimeout(r, 1500));

      const samples: Record<string, Partial<Lead>[]> = {
        leatherworkinggroup: [
          { company_name: 'Premium Leather Co.', contact_person: 'John Smith', email: 'john@premiumleather.com', country: 'Italy', source: 'leatherworkinggroup', status: 'new', industry_focus: 'Luxury Goods', address: [], tags: [] },
          { company_name: 'European Tannery Ltd', contact_person: 'Maria Garcia', email: 'maria@eutannery.com', country: 'Spain', source: 'leatherworkinggroup', status: 'new', industry_focus: 'Automotive', address: [], tags: [] },
        ],
        lineapelle: [
          { company_name: 'Milano Leather House', contact_person: 'Giuseppe Rossi', email: 'giuseppe@milanoleather.it', country: 'Italy', source: 'lineapelle', status: 'new', industry_focus: 'Fashion', address: [], tags: [] },
        ],
        aplf: [
          { company_name: 'Asia Pacific Leather', contact_person: 'Li Wei', email: 'li.wei@apleather.com', country: 'China', source: 'aplf', status: 'new', industry_focus: 'Footwear', address: [], tags: [] },
        ],
      };

      const leadsToImport = (samples[source] || []).map(l => ({ ...l, user_id: userId }));
      let successCount = 0;
      const errors: string[] = [];

      for (const lead of leadsToImport) {
        const { error } = await supabase.from('leads').insert([lead]);
        if (error) {
          errors.push(error.code === '23505' ? `Duplicate: ${lead.email}` : `${lead.company_name}: ${error.message}`);
        } else {
          successCount++;
        }
      }

      setImportResults({ success: successCount, errors, total: leadsToImport.length });
      if (successCount > 0) onLeadsImported();
    } catch (error: any) {
      dialogService.alert({ title: 'Import failed', message: error?.message || 'Please try again.', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleCSV = () => {
    const csv = `company_name,contact_person,email,phone,website,country,industry_focus,company_size,notes,address\n"Premium Leather Co.","John Smith","john@example.com","+1234567890","https://example.com","USA","Footwear","51-200","Great prospect","123 Main St"`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'sample_leads.csv' });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sourceOptions: { key: Source; label: string; sub: string; icon: React.ReactNode; iconColor: string }[] = [
    { key: 'csv',                label: 'CSV Upload',            sub: 'Upload a spreadsheet file',          icon: <Upload className="h-5 w-5" />,    iconColor: 'text-blue-600 bg-blue-50' },
    { key: 'leatherworkinggroup', label: 'Leather Working Group', sub: 'Import from member directory',       icon: <RefreshCw className="h-5 w-5" />, iconColor: 'text-teal-600 bg-teal-50' },
    { key: 'lineapelle',          label: 'Lineapelle',            sub: 'Import from exhibitor list',         icon: <RefreshCw className="h-5 w-5" />, iconColor: 'text-purple-600 bg-purple-50' },
    { key: 'aplf',                label: 'APLF',                  sub: 'Import from member database',        icon: <RefreshCw className="h-5 w-5" />, iconColor: 'text-green-600 bg-green-50' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">Import Leads</h2>
            <p className="text-xs text-gray-500 mt-0.5">Add leads from a file or industry directory</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Source selection */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Select Source</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sourceOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => { setSelectedSource(opt.key); setImportResults(null); }}
                  className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                    selectedSource === opt.key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${opt.iconColor} flex-shrink-0`}>{opt.icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* CSV section */}
          {selectedSource === 'csv' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">CSV Import</p>
                <button onClick={downloadSampleCSV} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-blue-50 rounded-xl transition-colors">
                  <Download className="h-3.5 w-3.5" /> Download Sample
                </button>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700 space-y-1">
                <p className="font-semibold text-blue-800 mb-1">Required columns:</p>
                <p>company_name, contact_person, email</p>
                <p className="text-blue-500 mt-1">Optional: phone, website, country, industry_focus, company_size, notes, address</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Select CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
                  disabled={loading}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Web import section */}
          {selectedSource !== 'csv' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Demo Mode</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    This imports sample data. In production, it would connect to the {selectedSource} member directory.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleWebImport(selectedSource as 'leatherworkinggroup' | 'lineapelle' | 'aplf')}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {loading ? 'Importing…' : `Import from ${sourceOptions.find(s => s.key === selectedSource)?.label}`}
              </button>
            </div>
          )}

          {/* Results */}
          {importResults && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Import Results</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
                  <CheckCircle className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-emerald-700">{importResults.success}</p>
                  <p className="text-xs text-emerald-600">Imported</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-600">{importResults.errors.length}</p>
                  <p className="text-xs text-red-500">Errors</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
                  <Upload className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{importResults.total}</p>
                  <p className="text-xs text-blue-600">Total</p>
                </div>
              </div>
              {importResults.errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 max-h-32 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-700 mb-2">Errors:</p>
                  <ul className="text-xs text-red-600 space-y-1">
                    {importResults.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-3xl flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeadImportModal;
