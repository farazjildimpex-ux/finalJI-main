"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, FileText, Calendar, ChevronRight, Inbox,
  ShieldCheck, AlertCircle, ExternalLink, Trash2, Mail, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { dialogService } from '../../lib/dialogService';
import { approveExtractedInvoice, type ExtractedInvoice } from '../../lib/emailSync';
import type { Invoice } from '../../types';

interface PendingItem {
  key: string;                 // unique id (scan_log_id + index)
  scanLogId: string;
  scanIndex: number;
  scannedAt: string | null;
  emailSubject: string;
  emailFrom: string;
  invoice: ExtractedInvoice;
}

const ApprovalsPage: React.FC = () => {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [approved, setApproved] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved'>('pending');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // 1) Approved invoices live in `invoices`.
      const invoicesResp = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_approved', true)
        .order('created_at', { ascending: false });
      if (invoicesResp.error) throw invoicesResp.error;
      const approvedList = (invoicesResp.data || []) as Invoice[];
      setApproved(approvedList);

      // 2) Pending invoices come from `email_scan_log.extracted_invoices`.
      //    A pending item is "still pending" if no row in `invoices` exists
      //    yet for that invoice_number.
      const scanResp = await supabase
        .from('email_scan_log')
        .select('id, created_at, email_subject, email_from, extracted_invoices')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (scanResp.error) throw scanResp.error;

      const allInvoiceNumbersResp = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('user_id', user.id);
      if (allInvoiceNumbersResp.error) throw allInvoiceNumbersResp.error;
      const existingNumbers = new Set(
        (allInvoiceNumbersResp.data || [])
          .map((r: any) => (r.invoice_number || '').trim())
          .filter(Boolean),
      );

      const items: PendingItem[] = [];
      const seenNumbers = new Set<string>();
      for (const row of scanResp.data || []) {
        const extracted = (row.extracted_invoices || []) as ExtractedInvoice[];
        extracted.forEach((inv, idx) => {
          const num = (inv.invoice_number || '').trim();
          if (!num) return;
          if (existingNumbers.has(num)) return; // already approved/persisted
          if (seenNumbers.has(num)) return;     // dedup across older scans
          seenNumbers.add(num);
          items.push({
            key: `${row.id}:${idx}`,
            scanLogId: row.id,
            scanIndex: idx,
            scannedAt: row.created_at,
            emailSubject: row.email_subject || '(no subject)',
            emailFrom: row.email_from || '',
            invoice: inv,
          });
        });
      }
      setPending(items);
    } catch (e: any) {
      setError(e?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onRefresh = () => load();
    window.addEventListener('jild-email-scan-log-refresh', onRefresh);
    return () => window.removeEventListener('jild-email-scan-log-refresh', onRefresh);
  }, [user?.id]);

  const handleApprovePending = async (item: PendingItem) => {
    if (!user) return;
    setBusyKey(item.key);
    setError(null);
    try {
      const result = await approveExtractedInvoice(item.invoice, user.id);
      if (!result.ok) throw new Error(result.error);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to approve');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDiscardPending = async (item: PendingItem) => {
    const ok = await dialogService.confirm({
      title: 'Discard this pending invoice?',
      message: `Invoice ${item.invoice.invoice_number} will be removed from the approval queue. The original email is untouched.`,
      confirmLabel: 'Discard',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyKey(item.key);
    try {
      // Remove this single extracted invoice from the scan log row so it
      // stops appearing in the queue. The original email is untouched.
      const { data: row, error: readErr } = await supabase
        .from('email_scan_log')
        .select('extracted_invoices')
        .eq('id', item.scanLogId)
        .single();
      if (readErr) throw readErr;

      const next = ((row?.extracted_invoices || []) as ExtractedInvoice[]).filter(
        (_inv, idx) => idx !== item.scanIndex,
      );
      const { error: updErr } = await supabase
        .from('email_scan_log')
        .update({ extracted_invoices: next })
        .eq('id', item.scanLogId);
      if (updErr) throw updErr;

      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to discard');
    } finally {
      setBusyKey(null);
    }
  };

  const handleUnapprove = async (inv: Invoice) => {
    if (!inv.id) return;
    const ok = await dialogService.confirm({
      title: 'Unapprove and remove this invoice?',
      message: `Invoice ${inv.invoice_number} will be deleted from your records. You can re-sync emails to bring it back for review.`,
      confirmLabel: 'Unapprove & remove',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(inv.id);
    try {
      const { error: err } = await supabase.from('invoices').delete().eq('id', inv.id);
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
    const ok = await dialogService.confirm({
      title: 'Delete invoice?',
      message: `Delete invoice ${inv.invoice_number}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
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

  const renderPendingRow = (item: PendingItem) => {
    const inv = item.invoice;
    const firstContract = inv.contract_numbers?.[0];
    const previewLink = firstContract
      ? `/app/contracts/${encodeURIComponent(firstContract)}`
      : '/app/contracts';
    const busy = busyKey === item.key;
    return (
      <div
        key={item.key}
        className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900 truncate">
                {inv.invoice_number}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700">
                Awaiting approval
              </span>
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

            <div className="mt-2 text-[11px] text-slate-500 flex items-start gap-1">
              <Mail className="h-3 w-3 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="truncate">{item.emailSubject}</p>
                {item.emailFrom && (
                  <p className="truncate text-slate-400">{item.emailFrom}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            onClick={() => handleApprovePending(item)}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {busy ? 'Approving…' : 'Approve & save'}
          </button>
          <Link
            to={previewLink}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open contract
          </Link>
          <button
            onClick={() => handleDiscardPending(item)}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 active:scale-95 transition"
          >
            <X className="h-3.5 w-3.5" /> Discard
          </button>
        </div>
      </div>
    );
  };

  const renderApprovedRow = (inv: Invoice) => {
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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-3 w-3" /> Approved
              </span>
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
          <button
            onClick={() => handleUnapprove(inv)}
            disabled={busyId === inv.id}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 active:scale-95 transition"
          >
            Unapprove
          </button>
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

  const list = useMemo(
    () => (tab === 'pending' ? pending : approved),
    [tab, pending, approved],
  );

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Invoice Approvals</h1>
        <p className="text-xs text-slate-500 mt-1">
          AI-extracted invoices stay here until you approve them. Nothing is saved to your
          records until you press Approve.
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
        <div className="space-y-3">
          {tab === 'pending'
            ? (list as PendingItem[]).map(renderPendingRow)
            : (list as Invoice[]).map(renderApprovedRow)}
        </div>
      )}
    </div>
  );
};

export default ApprovalsPage;
