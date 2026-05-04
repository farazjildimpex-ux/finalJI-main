import React, { useState } from 'react';
import {
  X, Download, Search, CheckCircle, Loader, Globe,
  MapPin, ExternalLink, Filter, Star, Info
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { dialogService } from '../../lib/dialogService';

interface LWGSupplier {
  company_name: string;
  country: string;
  website?: string;
  certification_type?: string;
  address?: string;
  selected?: boolean;
}

interface LWGScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadsImported: () => void;
}

const LWG_COUNTRIES = [
  'Albania','Algeria','Argentina','Australia','Austria','Azerbaijan','Bangladesh',
  'Belgium','Bolivia','Bosnia and Herzegovina','Brazil','Bulgaria','Cambodia',
  'Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark',
  'Dominican Republic','Ecuador','Egypt','Ethiopia','France','Germany','Hungary',
  'India','Indonesia','Iran','Italy','Japan','Kazakhstan','Kenya','Lithuania',
  'Mexico','Morocco','Netherlands','New Zealand','Nigeria','Norway','Pakistan',
  'Paraguay','Poland','Portugal','Romania','Saudi Arabia','Serbia','Singapore',
  'Slovakia','Slovenia','South Africa','South Korea','Spain','Sweden','Syria',
  'Taiwan','Tajikistan','Thailand','Tunisia','Turkiye','Uganda','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vietnam',
];

const LWG_RATINGS = ['Gold','Silver','Bronze','Audited','Approved'];

const RATING_STYLE: Record<string, string> = {
  Gold:     'bg-yellow-100 text-yellow-800 border-yellow-300',
  Silver:   'bg-gray-100 text-gray-700 border-gray-300',
  Bronze:   'bg-orange-100 text-orange-700 border-orange-300',
  Audited:  'bg-blue-100 text-blue-700 border-blue-300',
  Approved: 'bg-teal-100 text-teal-700 border-teal-300',
};

const LWGScraperModal: React.FC<LWGScraperModalProps> = ({ isOpen, onClose, onLeadsImported }) => {
  const [step, setStep]         = useState<'fetch' | 'preview' | 'done'>('fetch');
  const [scraping, setScraping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [suppliers, setSuppliers] = useState<LWGSupplier[]>([]);
  const [maxPages, setMaxPages]   = useState('3');

  // Filters set BEFORE fetching — used to pre-select matching rows after fetch
  const [filterCountry, setFilterCountry] = useState('');
  const [filterRating, setFilterRating]   = useState('');

  // Preview search (visual only, doesn't affect selected state)
  const [searchPreview, setSearchPreview] = useState('');

  const [lwgTotal, setLwgTotal] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; skipped: number; errors: number } | null>(null);

  const handleScrape = async () => {
    setScraping(true);
    setSuppliers([]);
    try {
      const params = new URLSearchParams({ pages: maxPages });
      const res = await fetch(`/api/scrape/lwg?${params}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Scrape failed');
      if (!data.suppliers?.length) {
        dialogService.alert({ title: 'No results', message: 'No supplier records found on LWG. Please try again.', tone: 'warning' });
        setScraping(false);
        return;
      }
      setLwgTotal(data.lwg_total || data.suppliers.length);

      // Apply country + rating filters to determine pre-selection.
      // If a filter is set, only matching suppliers are pre-selected (selected=true).
      // If no filter is set, all are pre-selected.
      const mapped = (data.suppliers as LWGSupplier[]).map(s => {
        const countryMatch = !filterCountry ||
          (s.country || '').toLowerCase() === filterCountry.toLowerCase();
        const ratingMatch = !filterRating ||
          (s.certification_type || '').toLowerCase() === filterRating.toLowerCase();
        return {
          ...s,
          selected: countryMatch && ratingMatch,
        };
      });

      // If filters produced zero selected, warn but still show all
      const selCount = mapped.filter(s => s.selected).length;
      if (selCount === 0 && (filterCountry || filterRating)) {
        dialogService.alert({
          title: 'No matches for your filter',
          message: `None of the fetched suppliers matched "${filterCountry || ''}${filterCountry && filterRating ? ' / ' : ''}${filterRating || ''}". Showing all — select manually.`,
          tone: 'warning',
        });
        setSuppliers(mapped.map(s => ({ ...s, selected: true })));
      } else {
        setSuppliers(mapped);
      }

      setStep('preview');
    } catch (err: any) {
      dialogService.alert({ title: 'Fetch failed', message: err.message || 'Could not reach leatherworkinggroup.com.', tone: 'danger' });
    } finally {
      setScraping(false);
    }
  };

  const toggleAll = (val: boolean) => setSuppliers(prev => prev.map(s => ({ ...s, selected: val })));
  const toggleOne = (idx: number) => setSuppliers(prev => prev.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s));

  // Visible = search filter (visual only — selection state unchanged)
  const visibleSuppliers = suppliers.filter(s => {
    const q = searchPreview.toLowerCase();
    return !q || s.company_name.toLowerCase().includes(q) || (s.country || '').toLowerCase().includes(q);
  });

  const selectedCount = suppliers.filter(s => s.selected).length;

  const handleImport = async () => {
    const toImport = suppliers.filter(s => s.selected);
    if (!toImport.length) {
      dialogService.alert({ title: 'Nothing selected', message: 'Select at least one supplier to import.', tone: 'warning' });
      return;
    }
    setImporting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      dialogService.alert({ title: 'Not signed in', message: 'Please sign in to import leads.', tone: 'danger' });
      setImporting(false);
      return;
    }

    const rows = toImport.map(s => {
      const noteParts: string[] = [];
      if (s.certification_type) noteParts.push(`LWG Rating: ${s.certification_type}`);
      noteParts.push('Imported from LWG certified-suppliers directory');
      return {
        user_id: user.id,
        company_name: s.company_name,
        contact_person: s.company_name,
        email: '',
        country: s.country || '',
        website: s.website || '',
        source: 'leatherworkinggroup' as const,
        status: 'new' as const,
        industry_focus: 'Leather',
        notes: noteParts.join('. '),
        tags: ['lwg', s.certification_type ? s.certification_type.toLowerCase() : 'certified'].filter(Boolean),
      };
    });

    const CHUNK = 50;
    let success = 0, skipped = 0, errors = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error, data } = await supabase.from('leads').insert(chunk).select('id');
      if (error) {
        if (error.code === '23505') skipped += chunk.length;
        else errors += chunk.length;
      } else {
        success += (data?.length ?? chunk.length);
      }
    }

    setImportResult({ success, skipped, errors });
    setStep('done');
    if (success > 0) onLeadsImported();
    setImporting(false);
  };

  const handleClose = () => {
    setStep('fetch');
    setSuppliers([]);
    setFilterCountry('');
    setFilterRating('');
    setMaxPages('3');
    setSearchPreview('');
    setImportResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-xl flex flex-col" style={{ maxHeight: '92dvh' }}>

        {/* Drag handle mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-100 rounded-xl flex items-center justify-center">
              <Globe className="h-5 w-5 text-teal-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Import from Leather Working Group</h2>
              <p className="text-xs text-gray-400">2,200+ certified suppliers · leatherworkinggroup.com</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step pills */}
        <div className="flex items-center px-6 py-2.5 bg-gray-50 border-b border-gray-100 text-xs gap-0 flex-shrink-0">
          {(['fetch','preview','done'] as const).map((s, i) => {
            const past = ['fetch','preview','done'].indexOf(step) > i;
            const active = step === s;
            return (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-1.5 font-semibold ${active ? 'text-blue-600' : past ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-blue-600 text-white' : past ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{i+1}</span>
                  <span className="hidden sm:inline">{s === 'fetch' ? 'Configure' : s === 'preview' ? 'Select' : 'Done'}</span>
                </div>
                {i < 2 && <div className="flex-1 h-px bg-gray-200 mx-3" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Configure ── */}
          {step === 'fetch' && (
            <div className="p-6 space-y-5">
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-teal-800 leading-relaxed">
                    <p className="font-semibold mb-1">How it works</p>
                    <p>Fetch suppliers from the public LWG directory (12 per page). Use the filters below to pre-select only the country or rating you want — unmatched suppliers will be deselected so you don't import them by accident.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">
                  Pages to fetch <span className="text-gray-400 font-normal normal-case tracking-normal">(12 suppliers each)</span>
                </label>
                <select value={maxPages} onChange={e => setMaxPages(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white">
                  <option value="1">1 page — up to 12 suppliers</option>
                  <option value="3">3 pages — up to 36 suppliers</option>
                  <option value="5">5 pages — up to 60 suppliers</option>
                  <option value="10">10 pages — up to 120 suppliers</option>
                </select>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5" /> Pre-select filter (optional)
                </p>
                <p className="text-xs text-gray-400">If you set a filter, only matching suppliers will be checked for import — you can still manually adjust.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" /> Country
                    </label>
                    <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white">
                      <option value="">All countries</option>
                      {LWG_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-gray-400" /> LWG Rating
                    </label>
                    <select value={filterRating} onChange={e => setFilterRating(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white">
                      <option value="">Any rating</option>
                      {LWG_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview & Select ── */}
          {step === 'preview' && (
            <div className="flex flex-col">
              {/* Info bar */}
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2 flex-shrink-0">
                <div>
                  <p className="text-sm font-bold text-gray-900">{suppliers.length} suppliers fetched</p>
                  <p className="text-xs text-gray-400">
                    {selectedCount} selected for import
                    {filterCountry ? ` · filtered: ${filterCountry}` : ''}
                    {filterRating ? `${filterCountry ? ',' : ' ·'} ${filterRating}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button onClick={() => toggleAll(true)} className="text-blue-600 font-semibold hover:underline">All</button>
                  <span className="text-gray-200">|</span>
                  <button onClick={() => toggleAll(false)} className="text-gray-500 hover:underline">None</button>
                  <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs font-bold">{selectedCount}</span>
                </div>
              </div>

              {/* Search */}
              <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input type="text" placeholder="Search by name or country…"
                    value={searchPreview} onChange={e => setSearchPreview(e.target.value)}
                    className="pl-8 pr-3 py-2 w-full text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                </div>
              </div>

              {searchPreview && (
                <div className="px-5 py-1.5 text-xs text-gray-400 border-b border-gray-100 flex-shrink-0">
                  Showing {visibleSuppliers.length} of {suppliers.length}
                </div>
              )}

              {/* Supplier list */}
              <div className="overflow-y-auto divide-y divide-gray-100">
                {visibleSuppliers.length === 0 && (
                  <p className="p-8 text-center text-sm text-gray-400">No suppliers match your search</p>
                )}
                {visibleSuppliers.map((s, i) => {
                  const idx = suppliers.indexOf(s);
                  const ratingStyle = RATING_STYLE[s.certification_type || ''] || '';
                  return (
                    <label key={i} className={`flex items-start gap-3 px-5 py-3 cursor-pointer transition-colors ${s.selected ? 'hover:bg-blue-50/40' : 'hover:bg-gray-50 opacity-50'}`}>
                      <input type="checkbox" checked={s.selected ?? false} onChange={() => toggleOne(idx)}
                        className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.company_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {s.country && (
                            <span className="text-xs text-gray-500 flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />{s.country}
                            </span>
                          )}
                          {s.certification_type && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-lg border font-medium ${ratingStyle}`}>
                              {s.certification_type}
                            </span>
                          )}
                          {s.website && (
                            <a href={s.website} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                              <ExternalLink className="h-3 w-3" /> profile
                            </a>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && importResult && (
            <div className="p-8 text-center space-y-5">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Import complete</h3>
                <p className="text-sm text-gray-400">Leads are now in your Lead IQ pipeline</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
                  <p className="text-2xl font-black text-green-700">{importResult.success}</p>
                  <p className="text-xs text-green-500 mt-1">Imported</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <p className="text-2xl font-black text-amber-700">{importResult.skipped}</p>
                  <p className="text-xs text-amber-500 mt-1">Duplicates</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                  <p className="text-2xl font-black text-red-700">{importResult.errors}</p>
                  <p className="text-xs text-red-400 mt-1">Errors</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Each lead is saved as "New" and tagged as LWG certified. Open a lead to add the contact person's details before reaching out.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <button onClick={handleClose} className="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors">
            {step === 'done' ? 'Close' : 'Cancel'}
          </button>
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <button onClick={() => setStep('fetch')}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Back
              </button>
            )}
            {step === 'fetch' && (
              <button onClick={handleScrape} disabled={scraping}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-60 transition-colors">
                {scraping ? <><Loader className="h-4 w-4 animate-spin" /> Fetching…</> : <><Download className="h-4 w-4" /> Fetch Suppliers</>}
              </button>
            )}
            {step === 'preview' && (
              <button onClick={handleImport} disabled={importing || selectedCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-60 transition-colors">
                {importing ? <><Loader className="h-4 w-4 animate-spin" /> Importing…</> : <><CheckCircle className="h-4 w-4" /> Import {selectedCount} Lead{selectedCount !== 1 ? 's' : ''}</>}
              </button>
            )}
            {step === 'done' && (
              <button onClick={() => { setStep('fetch'); setSuppliers([]); setImportResult(null); }}
                className="px-5 py-2.5 text-sm font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700">
                Fetch More
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LWGScraperModal;
