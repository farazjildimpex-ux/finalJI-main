"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, FileText, Calendar, ChevronRight, Inbox,
  ShieldCheck, AlertCircle, ExternalLink, Trash2, Mail, X,
  Eye, Truck, Hash, DollarSign, StickyNote, Package,
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
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [approved, setApproved] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved'>('pending');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailsItem, setDetailsItem] = useState<PendingItem | null>(null);
  const [detailsApproved, setDetailsApproved] = useState<Invoice | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const invoicesResp = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_approved', true)
        .order('created_at', { ascending: false });
      if (invoicesResp.error) throw invoicesResp.error;
      const approvedList = (invoicesResp.data || []) as Invoice[];
      setApproved(approvedList);

      const scanResp = await supabase
        .from('email_scan_log')
        .select('id, scanned_at, email_subject, email_from, extracted_invoices')
        .eq('user_id', user.id)
        .order('scanned_at', { ascending: false })
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
          if (existingNumbers.has(num)) return;
          if (seenNumbers.has(num)) return;
          seenNumbers.add(num);
          items.push({
            key: `${row.id}:${idx}`,
            scanLogId: row.id,
            scanIndex: idx,
            scannedAt: row.scanned_at,
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

  /**
   * Open a contract by its human contract_no (e.g. "JI-2025-001"). The
   * route `/app/contracts/:id` expects the contract row's UUID, so we
   * look it up first and navigate with state for an instant render.
   */
  const openContractByNumber = async (contractNo: string) => {
    if (!contractNo) return;
    try {
      const { data, error: err } = await supabase
        .from('contracts')
        .select('*')
        .eq('contract_no', contractNo)
        .maybeSingle();
      if (err) throw err;
      if (!data) {
        await dialogService.alert({
          title: 'Contract not found',
          message: `No contract with number "${contractNo}" exists yet. Create it first, then come back to approve this invoice.`,
        });
        return;
      }
      navigate(`/app/contracts/${data.id}`, { state: { contract: data } });
    } catch (e: any) {
      setError(e?.message || 'Failed to open contract');
    }
  };

  const handleApprovePending = async (item: PendingItem) => {
    if (!user) return;
    setBusyKey(item.key);
    setError(null);
    try {
      const result = await approveExtractedInvoice(item.invoice, user.id);
      if (!result.ok) throw new Error(result.error);
      setDetailsItem(null);
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

      setDetailsItem(null);
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
      setDetailsApproved(null);
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
      setDetailsApproved(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete');
    } finally {
      setBusyId(null);
    }
  };

  const renderPendingRow = (item: PendingItem) => {
    const inv = item.invoice;
    const busy = busyKey === item.key;
    return (
      <div
        key={item.key}
        className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm"
      >
        {/* Tap-to-view-details hit area */}
        <button
          type="button"
          onClick={() => setDetailsItem(item)}
          className="w-full text-left active:opacity-70 transition"
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
                {inv.line_items?.length ? (
                  <span className="inline-flex items-center gap-1">
                    <Package className="h-3 w-3" /> {inv.line_items.length} line{inv.line_items.length === 1 ? '' : 's'}
                  </span>
                ) : null}
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

              <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600">
                <Eye className="h-3 w-3" /> Tap to review all extracted fields
              </div>
            </div>
          </div>
        </button>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            onClick={() => handleApprovePending(item)}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {busy ? 'Approving…' : 'Approve & save'}
          </button>
          <button
            type="button"
            onClick={() => setDetailsItem(item)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition"
          >
            <Eye className="h-3.5 w-3.5" /> Details
          </button>
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
    return (
      <div
        key={inv.id}
        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
      >
        <button
          type="button"
          onClick={() => setDetailsApproved(inv)}
          className="w-full text-left active:opacity-70 transition"
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
              <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600">
                <Eye className="h-3 w-3" /> Tap to view full details
              </div>
            </div>
          </div>
        </button>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            onClick={() => handleUnapprove(inv)}
            disabled={busyId === inv.id}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 active:scale-95 transition"
          >
            Unapprove
          </button>
          <button
            type="button"
            onClick={() => firstContract ? openContractByNumber(firstContract) : navigate('/app/contracts')}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open
          </button>
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
          AI-extracted invoices stay here until you approve them. Tap any row to review every
          field that will be saved before approving.
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

      {/* Pending details modal */}
      {detailsItem && (
        <PendingDetailsModal
          item={detailsItem}
          onClose={() => setDetailsItem(null)}
          onApprove={() => handleApprovePending(detailsItem)}
          onDiscard={() => handleDiscardPending(detailsItem)}
          onOpenContract={openContractByNumber}
          busy={busyKey === detailsItem.key}
        />
      )}

      {/* Approved details modal */}
      {detailsApproved && (
        <ApprovedDetailsModal
          invoice={detailsApproved}
          onClose={() => setDetailsApproved(null)}
          onOpenContract={openContractByNumber}
        />
      )}
    </div>
  );
};

/* ---------------------------------------------------------------------- */
/*  Modal: pending invoice — full extracted-field review                  */
/* ---------------------------------------------------------------------- */

interface PendingDetailsModalProps {
  item: PendingItem;
  onClose: () => void;
  onApprove: () => void;
  onDiscard: () => void;
  onOpenContract: (contractNo: string) => void;
  busy: boolean;
}

const PendingDetailsModal: React.FC<PendingDetailsModalProps> = ({
  item, onClose, onApprove, onDiscard, onOpenContract, busy,
}) => {
  const inv = item.invoice;

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">
              Awaiting approval
            </p>
            <h2 className="text-lg font-black text-slate-900 truncate">
              {inv.invoice_number || '(no invoice number)'}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Extracted from email · {item.scannedAt ? new Date(item.scannedAt).toLocaleString() : '—'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 active:scale-95 transition"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Source email */}
          <Section icon={<Mail className="h-3.5 w-3.5" />} title="Source email">
            <Field label="Subject" value={item.emailSubject} />
            <Field label="From" value={item.emailFrom || '—'} />
          </Section>

          {/* Invoice basics */}
          <Section icon={<Hash className="h-3.5 w-3.5" />} title="Invoice basics">
            <Field label="Invoice number" value={inv.invoice_number || '—'} mono />
            <Field
              label="Invoice date"
              value={inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : '—'}
            />
            <Field
              label="Invoice value"
              value={inv.invoice_value || '—'}
              icon={<DollarSign className="h-3 w-3" />}
            />
          </Section>

          {/* Linked contracts */}
          <Section icon={<FileText className="h-3.5 w-3.5" />} title="Linked contracts">
            {inv.contract_numbers?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {inv.contract_numbers.map((c) => (
                  <button
                    key={c}
                    onClick={() => onOpenContract(c)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 transition"
                  >
                    <FileText className="h-3 w-3" /> {c}
                    <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-amber-600 inline-flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> No contract linked — approving will save without a contract reference.
              </p>
            )}
          </Section>

          {/* Shipping */}
          <Section icon={<Truck className="h-3.5 w-3.5" />} title="Shipping">
            <Field label="Bill type" value={inv.bill_type || '—'} />
            <Field label="Bill / AWB number" value={inv.bill_number || '—'} mono />
            <Field
              label="Shipping date"
              value={inv.shipping_date ? new Date(inv.shipping_date).toLocaleDateString() : '—'}
            />
          </Section>

          {/* Line items */}
          <Section icon={<Package className="h-3.5 w-3.5" />} title={`Line items (${inv.line_items?.length || 0})`}>
            {inv.line_items?.length ? (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                      <th className="py-2 pr-3">Color</th>
                      <th className="py-2 pr-3">Selection</th>
                      <th className="py-2 pr-3">Qty</th>
                      <th className="py-2">Pieces</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.line_items.map((li, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 font-semibold text-slate-800">{li.color || '—'}</td>
                        <td className="py-2 pr-3 text-slate-700">{li.selection || '—'}</td>
                        <td className="py-2 pr-3 text-slate-700">{li.quantity || '—'}</td>
                        <td className="py-2 text-slate-700">{li.pieces || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">No line items extracted.</p>
            )}
          </Section>

          {/* Notes */}
          {inv.notes ? (
            <Section icon={<StickyNote className="h-3.5 w-3.5" />} title="Notes">
              <p className="text-[12px] text-slate-700 whitespace-pre-wrap">{inv.notes}</p>
            </Section>
          ) : null}

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-800">
            <p className="font-bold mb-0.5">Review carefully before approving.</p>
            <p>
              These exact values will be inserted into your <span className="font-semibold">invoices</span> table.
              Approving cannot be undone in one click — you'll have to delete the invoice manually if it's wrong.
            </p>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="border-t border-slate-200 px-5 py-3 grid grid-cols-2 gap-2 bg-white">
          <button
            onClick={onDiscard}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-xl bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 active:scale-95 transition"
          >
            <X className="h-4 w-4" /> Discard
          </button>
          <button
            onClick={onApprove}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition"
          >
            <CheckCircle2 className="h-4 w-4" />
            {busy ? 'Approving…' : 'Approve & save'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------------- */
/*  Modal: approved invoice — read-only summary                           */
/* ---------------------------------------------------------------------- */

interface ApprovedDetailsModalProps {
  invoice: Invoice;
  onClose: () => void;
  onOpenContract: (contractNo: string) => void;
}

const ApprovedDetailsModal: React.FC<ApprovedDetailsModalProps> = ({
  invoice, onClose, onOpenContract,
}) => {
  const lineItems = (invoice.line_items || []) as Array<{
    color?: string; selection?: string; quantity?: string; pieces?: string;
  }>;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
              Approved
            </p>
            <h2 className="text-lg font-black text-slate-900 truncate">
              {invoice.invoice_number || '—'}
            </h2>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 active:scale-95 transition" aria-label="Close">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <Section icon={<Hash className="h-3.5 w-3.5" />} title="Invoice basics">
            <Field label="Invoice number" value={invoice.invoice_number || '—'} mono />
            <Field
              label="Invoice date"
              value={invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : '—'}
            />
            <Field label="Invoice value" value={invoice.invoice_value || '—'} icon={<DollarSign className="h-3 w-3" />} />
            {(invoice as any).source && (
              <Field label="Source" value={(invoice as any).source} />
            )}
          </Section>

          <Section icon={<FileText className="h-3.5 w-3.5" />} title="Linked contracts">
            {invoice.contract_numbers?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {invoice.contract_numbers.map((c) => (
                  <button
                    key={c}
                    onClick={() => onOpenContract(c)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 transition"
                  >
                    <FileText className="h-3 w-3" /> {c}
                    <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">None</p>
            )}
          </Section>

          <Section icon={<Truck className="h-3.5 w-3.5" />} title="Shipping">
            <Field label="Bill type" value={(invoice as any).bill_type || '—'} />
            <Field label="Bill / AWB number" value={(invoice as any).bill_number || '—'} mono />
            <Field
              label="Shipping date"
              value={(invoice as any).shipping_date ? new Date((invoice as any).shipping_date).toLocaleDateString() : '—'}
            />
          </Section>

          <Section icon={<Package className="h-3.5 w-3.5" />} title={`Line items (${lineItems.length})`}>
            {lineItems.length ? (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                      <th className="py-2 pr-3">Color</th>
                      <th className="py-2 pr-3">Selection</th>
                      <th className="py-2 pr-3">Qty</th>
                      <th className="py-2">Pieces</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((li, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-3 font-semibold text-slate-800">{li.color || '—'}</td>
                        <td className="py-2 pr-3 text-slate-700">{li.selection || '—'}</td>
                        <td className="py-2 pr-3 text-slate-700">{li.quantity || '—'}</td>
                        <td className="py-2 text-slate-700">{li.pieces || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">No line items.</p>
            )}
          </Section>

          {invoice.notes ? (
            <Section icon={<StickyNote className="h-3.5 w-3.5" />} title="Notes">
              <p className="text-[12px] text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------------- */
/*  Tiny presentational helpers                                           */
/* ---------------------------------------------------------------------- */

const Section: React.FC<{ icon?: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon, title, children,
}) => (
  <section>
    <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 inline-flex items-center gap-1.5">
      {icon}
      {title}
    </h3>
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-1.5">
      {children}
    </div>
  </section>
);

const Field: React.FC<{ label: string; value: string; mono?: boolean; icon?: React.ReactNode }> = ({
  label, value, mono, icon,
}) => (
  <div className="flex items-start justify-between gap-3 text-[11px]">
    <span className="text-slate-500 shrink-0">{label}</span>
    <span
      className={`text-right text-slate-900 font-semibold break-all ${
        mono ? 'font-mono' : ''
      } inline-flex items-center gap-1`}
    >
      {icon}
      {value}
    </span>
  </div>
);

export default ApprovalsPage;
