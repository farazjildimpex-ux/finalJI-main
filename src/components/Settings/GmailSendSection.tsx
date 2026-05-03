"use client";

import React, { useEffect, useState } from 'react';
import {
  Mail, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ExternalLink, AlertCircle, Loader2, RefreshCw, Info,
} from 'lucide-react';

interface SendStatus {
  configured: boolean;
  hasSendScope: boolean;
  email: string | null;
  error?: string;
}

const GmailSendSection: React.FC = () => {
  const [status, setStatus]   = useState<SendStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/gmail/send-status');
      const d = await r.json();
      setStatus(d);
      if (!d.configured || !d.hasSendScope) setExpanded(true);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const isReady = status?.configured && status?.hasSendScope;
  const needsReauth = status?.configured && !status?.hasSendScope;

  const reauthorize = () => {
    window.open('/api/google/oauth/start', '_blank', 'noopener,width=640,height=720');
  };

  return (
    <div
      className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${isReady ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <Mail className={`h-4 w-4 ${isReady ? 'text-emerald-600' : 'text-amber-500'}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              Outgoing Email (Gmail)
              {loading ? (
                <Loader2 className="inline h-3.5 w-3.5 ml-1.5 animate-spin text-slate-400" />
              ) : isReady ? (
                <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">
                  <AlertCircle className="h-2.5 w-2.5" /> Action needed
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500">
              {isReady
                ? `Sending from ${status?.email || 'your Gmail account'} with real PDF attachments`
                : needsReauth
                ? 'Re-authorize Google to add email sending permission'
                : 'Connect your Google account to send emails'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={fetchStatus} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => setExpanded(p => !p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Detail panel */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-6 pt-5 space-y-5">

          {isReady && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>
                <strong>Gmail sending is active.</strong> Emails are sent directly from{' '}
                <strong>{status?.email}</strong> with PDF files attached properly — no download links.
              </span>
            </div>
          )}

          {needsReauth && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-sm text-amber-900">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-bold mb-1">One-time re-authorization required</p>
                <p className="text-xs leading-relaxed">
                  Your Google account is connected for invoice reading but doesn't yet have email
                  sending permission. Click <strong>"Re-authorize Google"</strong> below, sign in,
                  and click Allow — it takes 30 seconds. Your existing invoice sync will keep working.
                </p>
              </div>
            </div>
          )}

          {!status?.configured && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3 text-sm text-slate-700">
              <Info className="h-5 w-5 shrink-0 mt-0.5 text-slate-400" />
              <div>
                <p className="font-bold mb-1">Google account not connected</p>
                <p className="text-xs leading-relaxed">
                  Make sure <code className="bg-slate-200 px-1 rounded text-xs">GOOGLE_CLIENT_ID</code>,{' '}
                  <code className="bg-slate-200 px-1 rounded text-xs">GOOGLE_CLIENT_SECRET</code>, and{' '}
                  <code className="bg-slate-200 px-1 rounded text-xs">GOOGLE_REFRESH_TOKEN</code> are
                  set in Replit Secrets, then restart the workflow and click the refresh icon above.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <button
              onClick={reauthorize}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
            >
              <ExternalLink className="h-4 w-4" />
              {needsReauth ? 'Re-authorize Google' : 'Connect Google Account'}
            </button>
            {(isReady || needsReauth) && (
              <p className="text-xs text-slate-400 self-center">
                After authorizing, save the refresh token as{' '}
                <code className="bg-slate-100 px-1 rounded">GOOGLE_REFRESH_TOKEN</code>, restart
                the workflow, then click the refresh icon above.
              </p>
            )}
          </div>

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-2 text-xs text-blue-800">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>Why Gmail?</strong> Gmail's API supports real PDF attachments — the file
              arrives directly in the recipient's inbox like any normal email. Zoho's free plan
              doesn't support attachments via their API.
            </span>
          </div>

          {status?.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{status.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GmailSendSection;
