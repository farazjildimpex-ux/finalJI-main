"use client";

import React, { useEffect, useState } from 'react';
import {
  Mail, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ExternalLink, Copy, Check, AlertCircle, Loader2, RefreshCw, Info,
} from 'lucide-react';

interface ZohoStatus {
  configured: boolean; hasFromEmail: boolean; missing: Record<string, boolean>;
}

const ZohoSetupSection: React.FC = () => {
  const [status, setStatus]         = useState<ZohoStatus | null>(null);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState(false);
  const [copied, setCopied]         = useState<string | null>(null);
  const [redirectUri, setRedirectUri] = useState('');

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/zoho/status');
      const d = await r.json();
      setStatus(d);
      if (!d.configured && !expanded) setExpanded(true);
    } catch (_) { setStatus(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStatus(); }, []);
  useEffect(() => {
    fetch('/api/zoho/oauth/redirect-uri')
      .then(r => r.json())
      .then(d => setRedirectUri(d.redirectUri || ''))
      .catch(() => {});
  }, []);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const startOAuth = () => {
    window.open('/api/zoho/oauth/start', '_blank', 'noopener,width=640,height=720');
  };

  const missingKeys = status ? Object.entries(status.missing).filter(([, v]) => v).map(([k]) => k) : [];
  const isConnected = status?.configured && status?.hasFromEmail;

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>

      {/* Header row */}
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${isConnected ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <Mail className={`h-4 w-4 ${isConnected ? 'text-emerald-600' : 'text-amber-500'}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              Email (Zoho Mail)
              {loading ? (
                <Loader2 className="inline h-3.5 w-3.5 ml-1.5 animate-spin text-slate-400" />
              ) : isConnected ? (
                <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-600">
                  <XCircle className="h-2.5 w-2.5" /> Not connected
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500">
              {isConnected ? 'Outgoing email is working.' : `Missing: ${missingKeys.join(', ') || 'credentials'}`}
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

      {/* Setup guide */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-6 pt-5">
          <p className="text-sm font-bold text-slate-800 mb-5">Step-by-step setup guide</p>

          <div className="space-y-6">
            {/* Step 1 */}
            <Step num={1} title="Create a Zoho Mail account">
              <p className="text-sm text-slate-600">Go to zoho.com/mail and sign up (free plan works). Use the email address you want to send from, e.g. <code className="bg-slate-100 px-1 rounded text-xs">info@yourdomain.com</code>.</p>
              <ExtLink href="https://www.zoho.com/mail/">Open Zoho Mail</ExtLink>
            </Step>

            {/* Step 2 */}
            <Step num={2} title="Register your app in Zoho API Console">
              <p className="text-sm text-slate-600">
                Open the Zoho API Console, click <strong>"Add Client"</strong>, choose <strong>"Server-based Applications"</strong>.
                Set the <strong>Authorized Redirect URI</strong> to exactly the value below — copy it precisely:
              </p>
              {redirectUri && (
                <div className="flex items-center gap-2 mt-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <code className="text-xs text-blue-800 flex-1 break-all font-mono">{redirectUri}</code>
                  <button onClick={() => copyText(redirectUri, 'uri')} className="shrink-0 p-1.5 hover:bg-blue-100 rounded-lg transition">
                    {copied === 'uri' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-blue-600" />}
                  </button>
                </div>
              )}
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-2 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Important:</strong> This redirect URI must be done from the <strong>Replit preview</strong> (not your Netlify site).
                  The OAuth flow runs through the backend server on Replit.
                  Copy the Client ID and Client Secret after creating the app.
                </span>
              </p>
              <ExtLink href="https://api-console.zoho.com/">Open Zoho API Console</ExtLink>
            </Step>

            {/* Step 3 */}
            <Step num={3} title="Save your credentials as Replit Secrets">
              <p className="text-sm text-slate-600 mb-2">In Replit, open <strong>Secrets</strong> and add these four entries (ZOHO_REFRESH_TOKEN comes from step 4):</p>
              <div className="space-y-1.5">
                {([
                  { key: 'ZOHO_CLIENT_ID',     hint: 'From step 2 — Zoho API Console' },
                  { key: 'ZOHO_CLIENT_SECRET',  hint: 'From step 2 — Zoho API Console' },
                  { key: 'ZOHO_FROM_EMAIL',     hint: 'The email address you send from' },
                  { key: 'ZOHO_REFRESH_TOKEN',  hint: 'Generated in step 4 below' },
                ] as const).map(s => {
                  const missing = status?.missing[s.key];
                  return (
                    <div key={s.key} className={`flex items-center justify-between px-3 py-2 rounded-xl border text-sm ${missing ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-center gap-2">
                        {missing
                          ? <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        }
                        <code className={`font-mono font-bold text-xs ${missing ? 'text-red-700' : 'text-emerald-700'}`}>{s.key}</code>
                      </div>
                      <span className="text-xs text-slate-500">{s.hint}</span>
                    </div>
                  );
                })}
              </div>
            </Step>

            {/* Step 4 */}
            <Step num={4} title="Authorize with Zoho to get your Refresh Token">
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  Make sure you've saved <code className="bg-slate-100 px-1 rounded text-xs">ZOHO_CLIENT_ID</code> and{' '}
                  <code className="bg-slate-100 px-1 rounded text-xs">ZOHO_CLIENT_SECRET</code> first, then restart the server,
                  and come back here.
                </p>
                <p>
                  Click <strong>"Authorize with Zoho"</strong> below — it will open a <strong>popup window</strong>.
                  Sign in with your Zoho account and click Allow. After approval, the popup will show your <strong>Refresh Token</strong>.
                </p>
                <p>
                  Copy that token, go to Replit Secrets, and save it as{' '}
                  <code className="bg-slate-100 px-1 rounded text-xs">ZOHO_REFRESH_TOKEN</code>.
                </p>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2 text-xs text-blue-800">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>This must be done from the Replit preview tab</strong>, not your Netlify site.
                    Open this Settings page directly from <code className="bg-blue-100 px-1 rounded">{window.location.origin}</code>.
                  </span>
                </div>
              </div>
              <button
                onClick={startOAuth}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
              >
                <ExternalLink className="h-4 w-4" /> Authorize with Zoho
              </button>
            </Step>

            {/* Step 5 */}
            <Step num={5} title="Restart the server and test">
              <p className="text-sm text-slate-600">
                After saving all four secrets, restart the workflow (<strong>"Start application"</strong>) in Replit.
                Come back to this page and click the <RefreshCw className="inline h-3.5 w-3.5" /> icon above —
                you should see the green <strong>Connected</strong> badge.
              </p>
            </Step>
          </div>

          {isConnected && (
            <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span><strong>Zoho Mail is connected.</strong> Emails will be sent from your configured address.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Helpers ── */
const Step: React.FC<{ num: number; title: string; children: React.ReactNode }> = ({ num, title, children }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
      {num}
    </div>
    <div className="flex-1 space-y-2">
      <p className="text-sm font-bold text-slate-800">{title}</p>
      {children}
    </div>
  </div>
);

const ExtLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline mt-1">
    {children} <ExternalLink className="h-3.5 w-3.5" />
  </a>
);

export default ZohoSetupSection;
