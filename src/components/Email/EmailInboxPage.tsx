import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ChevronRight, Inbox, Mail, Paperclip, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { EmailData } from '../../lib/emailSync';
import { fetchZohoEmails } from '../../lib/emailSync';
import { getEmailSnippet, sortZohoEmails } from '../../lib/zohoMail';
import MobilePageHeader from '../Layout/MobilePageHeader';

type Filter = 'important' | 'all' | 'attachments';

const EmailInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('important');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadEmails = async (showSpinner = false) => {
    try {
      if (showSpinner) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const { emails: data } = await fetchZohoEmails();
      setEmails(data || []);
      if (!selectedId && (data || []).length > 0) {
        setSelectedId((data || [])[0].id || null);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load Zoho mail.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadEmails();
  }, []);

  const filteredEmails = useMemo(() => {
    const sorted = sortZohoEmails(emails);
    const important = sorted.filter(email => email.attachments.length > 0 || /invoice|payment|delivery|sample|contract|urgent/i.test(email.subject + ' ' + email.body));
    if (filter === 'attachments') return sorted.filter(email => email.attachments.length > 0);
    if (filter === 'all') return sorted;
    return important.length > 0 ? important : sorted.slice(0, 10);
  }, [emails, filter]);

  const selectedEmail = filteredEmails.find(email => email.id === selectedId) || filteredEmails[0] || null;

  useEffect(() => {
    if (!selectedEmail && filteredEmails.length > 0) setSelectedId(filteredEmails[0].id || null);
  }, [filteredEmails, selectedEmail]);

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="mx-auto max-w-7xl px-4 py-4 md:py-6">
        <MobilePageHeader
          eyebrow="Zoho Mail"
          title="Email"
          subtitle="Important mail, attachments and recent inbox activity."
          action={(
            <button
              type="button"
              onClick={() => loadEmails(true)}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 p-2.5 text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60 md:hidden"
              disabled={refreshing}
              aria-label="Refresh mail"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        />

        <div className="mb-4 hidden items-center justify-between gap-3 md:flex">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Zoho Mail</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Email</h1>
            <p className="mt-1 text-sm text-slate-500">Important mail, attachments and recent inbox activity.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/home')}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </button>
            <button
              type="button"
              onClick={() => loadEmails(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {([
            ['important', 'Important'],
            ['all', 'All'],
            ['attachments', 'Attachments'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                filter === value ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden min-h-[60vh]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">Inbox</p>
                <p className="text-xs text-slate-400">{filteredEmails.length} messages</p>
              </div>
              <Inbox className="h-4 w-4 text-slate-400" />
            </div>

            <div className="max-h-[68vh] overflow-y-auto no-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
                </div>
              ) : filteredEmails.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-700">No mail found</p>
                  <p className="mt-1 text-xs text-slate-400">Zoho inbox preview will appear here.</p>
                </div>
              ) : filteredEmails.map((email) => {
                const active = email.id === selectedEmail?.id;
                const important = email.attachments.length > 0 || /invoice|payment|delivery|sample|contract|urgent/i.test(email.subject + ' ' + email.body);
                return (
                  <button
                    key={`${email.id}-${email.date}`}
                    type="button"
                    onClick={() => setSelectedId(email.id || null)}
                    className={`w-full border-b border-slate-100 px-4 py-3 text-left transition ${
                      active ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-500 flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900 truncate">{email.subject || '(no subject)'}</p>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {new Date(email.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 truncate">{email.from || 'Unknown sender'}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{getEmailSnippet(email)}</p>
                        <div className="mt-2 flex items-center gap-2">
                          {important && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Important</span>}
                          {email.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                              <Paperclip className="h-3 w-3" /> {email.attachments.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 ${active ? 'text-blue-500' : 'text-slate-300'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden min-h-[60vh]">
            {selectedEmail ? (
              <>
                <div className="border-b border-slate-100 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Message preview</p>
                      <h2 className="mt-1 text-lg font-black text-slate-950 break-words">{selectedEmail.subject || '(no subject)'}</h2>
                      <p className="mt-1 text-sm text-slate-500 break-words">{selectedEmail.from || 'Unknown sender'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-500">
                      {new Date(selectedEmail.date).toLocaleString('en-GB')}
                    </span>
                  </div>
                </div>

                <div className="max-h-[68vh] overflow-y-auto no-scrollbar px-4 py-4">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                    {selectedEmail.body || 'No message body available.'}
                  </div>

                  {selectedEmail.attachments.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 mb-2">Attachments</p>
                      <div className="space-y-2">
                        {selectedEmail.attachments.map((att, index) => (
                          <div
                            key={`${selectedEmail.id}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{att.name}</p>
                              <p className="text-xs text-slate-400 truncate">{att.type}</p>
                            </div>
                            {att.dataBase64 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const mime = att.mimeType || 'application/octet-stream';
                                  const url = `data:${mime};base64,${att.dataBase64}`;
                                  window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                                className="rounded-xl bg-slate-950 px-3 py-1.5 text-[11px] font-bold text-white"
                              >
                                Open
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center px-6 py-16 text-center">
                <div>
                  <Mail className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">Select a message</p>
                  <p className="mt-1 text-xs text-slate-400">Mail preview appears here.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default EmailInboxPage;
