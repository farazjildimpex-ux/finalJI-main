"use client";

import React, { useEffect, useState } from 'react';
import {
  Mail, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ExternalLink, Copy, Check, AlertCircle, Loader2, RefreshCw,
} from 'lucide-react';

interface ZohoStatus {
  configured: boolean;
  hasFromEmail: boolean;
  missing: Record<string, boolean>;
}

const STEPS = [
  {
    num: 1,
    title: 'Create a Zoho Mail account',
    body: 'Go to zoho.com/mail and sign up (free plan works). Use the email address you want to send from, e.g. info@yourdomain.com.',
    link: 'https://www.zoho.com/mail/',
    linkLabel: 'Open Zoho Mail →',
  },
  {
    num: 2,
    title: 'Register a Zoho API application',
    body: 'Go to the Zoho API Console and click "Add Client". Choose "Server-based Applications". Set the redirect URI to the value shown below. Copy the Client ID and Client Secret.',
    link: 'https://api-console.zoho.com/',
    linkLabel: 'Open Zoho API Console →',
    showRedirectUri: true,
  },
  {
    num: 3,
    title: 'Save credentials as Replit Secrets',
    body: 'In Replit Secrets, add these four entries:',
    secrets: [
      { key: 'ZOHO_CLIENT_ID', hint: 'From step 2' },
      { key: 'ZOHO_CLIENT_SECRET', hint: 'From step 2' },
      { key: 'ZOHO_FROM_EMAIL', hint: 'The email address you send from' },
      { key: 'ZOHO_REFRESH_TOKEN', hint: 'Generated in step 4 below' },
    ],
  },
  {
    num: 4,
    title: 'Authorize the app to get a refresh token',
    body: 'Click the button below to start the OAuth flow. You will be redirected to Zoho to grant access. After approval, copy the refresh token and save it as ZOHO_REFRESH_TOKEN in Replit Secrets.',
    showOAuthButton: true,
  },
  {
    num: 5,
    title: 'Restart the server and test',
    body: 'After saving all secrets, restart the Replit workflow ("Start application"). Come back here and click "Check status" — you should see the green Connected badge.',
  },
];

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
    } catch (_) {
      setStatus(null);
    } finally {
      setLoading(false);
    }
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

  const startOAuth = async () => {
    window.open('/api/zoho/oauth/start', '_blank', 'noopener,width=600,height=700');
  };

  const missingKeys = status ? Object.entries(status.missing).filter(([, v]) => v).map(([k]) => k) : [];
  const isConnected = status?.configured && status?.hasFromEmail;

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${isConnected ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <Mail className={`h-4 w-4 ${isConnected ? 'text-emerald-600' : 'text-amber-500'}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">
              Email (Zoho Mail)
              {loading ? (
                <Loader2 className="inline h-3.5 w-3.5 ml-1.5 animate-spin text-slate-400" />
              ) : isConnected ? (
                <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-600">
                  <XCircle className="h-2.5 w-2.5" /> Not connected
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500">
              {isConnected
                ? 'Outgoing email is working — ZOHO_REFRESH_TOKEN is set.'
                : `Missing: ${missingKeys.join(', ') || 'credentials'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={fetchStatus} className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500" title="Refresh status">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setExpanded((p) => !p)}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Setup guide */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-5 pt-4">
          <p className="text-xs font-bold text-slate-700 mb-4">Step-by-step setup guide</p>

          <div className="space-y-5">
            {STEPS.map((step) => (
              <div key={step.num} className="flex gap-3">
                {/* Step number */}
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center mt-0.5">
                  {step.num}
                </div>
                <div className="flex-1 space-y-1.5">
                  <p className="text-xs font-black text-slate-800">{step.title}</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{step.body}</p>

                  {/* Redirect URI */}
                  {step.showRedirectUri && redirectUri && (
                    <div className="flex items-center gap-2 mt-1 p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <code className="text-[10px] text-blue-700 flex-1 break-all">{redirectUri}</code>
                      <button onClick={() => copyText(redirectUri, 'uri')} className="shrink-0 p-1 hover:bg-slate-200 rounded transition">
                        {copied === 'uri' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                      </button>
                    </div>
                  )}

                  {/* Secret keys table */}
                  {step.secrets && (
                    <div className="mt-1.5 space-y-1">
                      {step.secrets.map((s) => {
                        const missing = status?.missing[s.key];
                        return (
                          <div key={s.key} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[10px] ${missing ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                            <div className="flex items-center gap-2">
                              {missing
                                ? <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                                : <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                              }
                              <code className={`font-mono font-black ${missing ? 'text-red-700' : 'text-emerald-700'}`}>{s.key}</code>
                            </div>
                            <span className="text-slate-500">{s.hint}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* OAuth button */}
                  {step.showOAuthButton && (
                    <button
                      onClick={startOAuth}
                      className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Authorize with Zoho
                    </button>
                  )}

                  {step.link && (
                    <a
                      href={step.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                    >
                      {step.linkLabel} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isConnected && (
            <div className="mt-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span><strong>Zoho Mail is connected.</strong> Emails will be sent from your configured address via Zoho SMTP.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ZohoSetupSection;
