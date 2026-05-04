"use client";

import React, { useEffect, useState } from 'react';
import {
  Mail, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ExternalLink, AlertCircle, Loader2, RefreshCw,
} from 'lucide-react';

const OFFICE_EMAIL = 'office@jildimpex.com';

interface SendStatus {
  configured: boolean;
  hasSendScope: boolean;
  email: string | null;
  error?: string;
}

const Step: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <div className="flex gap-3">
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-black mt-0.5">{n}</div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold text-gray-800 mb-1">{title}</p>
      <div className="text-xs text-gray-500 leading-relaxed space-y-1">{children}</div>
    </div>
  </div>
);

const GmailSendSection: React.FC = () => {
  const [status, setStatus]     = useState<SendStatus | null>(null);
  const [loading, setLoading]   = useState(true);
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

  const isReady     = status?.configured && status?.hasSendScope;
  const needsReauth = status?.configured && !status?.hasSendScope;

  const startOAuth = () => {
    window.open('/api/google/oauth/start', '_blank', 'noopener,width=640,height=720');
  };

  const ConnectSteps = () => (
    <div className="space-y-4">
      <Step n={1} title="Click the button below">
        <p>Tap <strong>"Connect Google Account"</strong>. A Google sign-in window will open.</p>
      </Step>

      <Step n={2} title={`Sign in with ${OFFICE_EMAIL}`}>
        <p>
          Sign in with <strong>{OFFICE_EMAIL}</strong> (the JILD IMPEX Google Workspace account).
          If another account is already selected in Google, click <em>"Use a different account"</em> and enter {OFFICE_EMAIL}.
        </p>
      </Step>

      <Step n={3} title="Copy the token shown">
        <p>After approving, you'll see a token starting with <code className="bg-gray-100 px-1 rounded">1//</code>. Copy the entire value.</p>
      </Step>

      <Step n={4} title='Save it as "GOOGLE_REFRESH_TOKEN" in Replit Secrets'>
        <p>Go to <strong>Replit → Secrets</strong> (lock icon in the sidebar). Add a secret named <code className="bg-gray-100 px-1 rounded">GOOGLE_REFRESH_TOKEN</code> with the copied value.</p>
      </Step>

      <Step n={5} title="Restart the workflow">
        <p>Restart the app from the Shell tab, then tap the refresh icon ↻ here to confirm it's connected.</p>
      </Step>

      <button
        onClick={startOAuth}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm mt-2"
      >
        <ExternalLink className="h-4 w-4" />
        Connect {OFFICE_EMAIL}
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${isReady ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <Mail className={`h-4 w-4 ${isReady ? 'text-emerald-600' : 'text-amber-500'}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
              Outgoing Email
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
              ) : isReady ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">
                  <AlertCircle className="h-2.5 w-2.5" /> Setup needed
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500">
              {isReady
                ? `Sending from ${OFFICE_EMAIL}`
                : `Connect ${OFFICE_EMAIL} to send emails with PDF attachments`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={fetchStatus} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" title="Refresh status">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={() => setExpanded(p => !p)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-6 pt-5 space-y-5">

          {/* Connected state */}
          {isReady && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Gmail sending is active</p>
                <p className="text-xs mt-0.5 text-emerald-700">
                  Emails are sent from <strong>{OFFICE_EMAIL}</strong> with real PDF attachments — files arrive directly in the recipient's inbox.
                </p>
              </div>
            </div>
          )}

          {/* Needs reauth */}
          {needsReauth && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-sm text-amber-900">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-bold mb-1">One-time re-authorization needed</p>
                <p className="text-xs leading-relaxed">Your Google account is connected but doesn't yet have email-sending permission. Follow the steps below — it takes about 30 seconds.</p>
              </div>
            </div>
          )}

          {/* Not configured */}
          {!status?.configured && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
              <p>Connect <strong>{OFFICE_EMAIL}</strong> to send contract PDFs and letters directly from the app.</p>
            </div>
          )}

          {/* Show steps when not ready */}
          {!isReady && <ConnectSteps />}

          {/* Error */}
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
