"use client";

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, FileText, Calendar, ChevronRight, Inbox,
  ShieldCheck, AlertCircle, ExternalLink, Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { dialogService } from '../../lib/dialogService';
import type { Invoice } from '../../types';

const ApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const [pending, setPending] = useState<Invoice[]>([]);
  const [approved, setApproved] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (err) throw err;
      const all = (data || []) as Invoice[];
      setPending(all.filter((i) => !i.is_approved && i.source === 'email_sync'));
      setApproved(all.filter((i) => i.is_approved));
    } catch (e: any) {
      setError(e?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleApprove = async (inv: Invoice) => {
    if (!inv.id || !user) return;
    setBusyId(inv.id);
    try {
      const { error: err } = await supabase
        .from('invoices')
        .update({ is_approved: true, approved_at: new Date().toISOString(), approved_by: user.id })
        .eq('id', inv.id);
      if (err) throw err;
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to approve');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnapprove = async (inv: Invoice) => {
    if (!inv.id) return;
    setBusyId(inv.id);
    try {
      const { error: err } = await supabase
        .from('invoices')
        .update({ is_approved: false, approved_at: null, approved_by: null })
        .eq('id', inv.id);
      if (err) throw err;
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to unapprove');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (inv: Invoice) => {
    if (!inv.id) return;
    const ok = await dialogService.confirm(
      `Delete invoice ${inv.invoice_number}? This cannot be undone.`
    );
    if (!ok) return;
    setBusyId(inv.id);
    try {
      const { error: err } = await supabase.from('invoices').delete().eq('id', inv.id);
      if (err) throw err;
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete');
    } finally {
      setBusyId(null);
    }
  };

  const renderRow = (inv: Invoice) => {
    const firstContract = inv.contract_numbers?.[0];
    const editLink = firstContract
      ? `/app/contracts/${encodeURIComponent(firstContract)}`
      : '/app/contracts';
    return (
      <div
        key={inv.id}
        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900 truncate">
                {inv.invoice_number}
              </span>
              {inv.is_approved && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="h-3 w-3" /> Approved
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              {inv.invoice_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(inv.invoice_date).toLocaleDateString()}
                </span>
              )}
              {inv.invoice_value && (
                <span className="font-semibold text-slate-700">
                  Value: {inv.invoice_value}
                </span>
              )}
            </div>
            {inv.contract_numbers?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {inv.contract_numbers.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700"
                  >
                    <FileText className="h-3 w-3" /> {c}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-amber-600 inline-flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> No contract linked
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {!inv.is_approved ? (
            <button
              onClick={() => handleApprove(inv)}
              disabled={busyId === inv.id}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </button>
          ) : (
            <button
              onClick={() => handleUnapprove(inv)}
              disabled={busyId === inv.id}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 active:scale-95 transition"
            >
              Unapprove
            </button>
          )}
          <Link
            to={editLink}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Edit
          </Link>
          <button
            onClick={() => handleDelete(inv)}
            disabled={busyId === inv.id}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 active:scale-95 transition"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
    );
  };

  const list = tab === 'pending' ? pending : approved;

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Invoice Approvals</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review invoices that the AI synced from your email. Approving locks them so future syncs
          will skip them and never overwrite your edits.
        </p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-4">
        <button
          onClick={() => setTab('pending')}
          className={`px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
            tab === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          Pending ({pending.length})
        </button>
        <button
          onClick={() => setTab('approved')}
          className={`px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
            tab === 'approved' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          Approved ({approved.length})
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-sm text-slate-400">Loading…</div>
      ) : list.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Inbox className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">
            {tab === 'pending' ? 'Nothing waiting for approval' : 'No approved invoices yet'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {tab === 'pending'
              ? 'Run an email sync to bring in invoices for review.'
              : 'Approve some pending invoices and they will show up here.'}
          </p>
          {tab === 'pending' && (
            <Link
              to="/app/settings"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              Go to Email Sync <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">{list.map(renderRow)}</div>
      )}
    </div>
  );
};

export default ApprovalsPage;
