import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronRight, Inbox, Mail, Paperclip } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { EmailData } from '../../lib/emailSync';
import { fetchZohoEmails } from '../../lib/emailSync';
import { getEmailSnippet, sortZohoEmails } from '../../lib/zohoMail';

interface EmailPreviewSectionProps {
  compact?: boolean;
  className?: string;
  onOpenPage?: () => void;
}

const SWIPE_THRESHOLD = 52;

const EmailPreviewSection: React.FC<EmailPreviewSectionProps> = ({ compact = false, className = '', onOpenPage }) => {
  const navigate = useNavigate();
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const { emails: data } = await fetchZohoEmails();
        if (!active) return;
        setEmails(data || []);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Could not load Zoho mail.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const visibleEmails = useMemo(() => {
    const sorted = sortZohoEmails(emails);
    return sorted.slice(0, compact ? 3 : 4);
  }, [emails, compact]);

  const importantCount = useMemo(
    () => emails.filter(email => email.attachments.length > 0 || /invoice|payment|delivery|sample|contract|urgent/i.test(email.subject + ' ' + email.body)).length,
    [emails]
  );

  const openPage = () => {
    if (onOpenPage) onOpenPage();
    else navigate('/app/email');
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y);
    touchStart.current = null;
    if (dx > SWIPE_THRESHOLD && dy < 36) openPage();
  };

  return (
    <section
      className={`rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden ${className}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-100">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-slate-950 leading-tight">Email</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{importantCount} important in Zoho</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={openPage}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-950 px-3 py-2 text-[11px] font-bold text-white active:scale-95 transition-transform"
        >
          <Inbox className="h-3.5 w-3.5" />
          Open
        </button>
      </div>

      <div className={compact ? 'px-3 py-2.5' : 'px-4 py-3'}>
        {loading ? (
          <div className="flex items-center justify-center py-5">
            <div className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="min-w-0">{error}</span>
          </div>
        ) : visibleEmails.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
            <p className="text-[12px] font-semibold text-slate-700">No mail found</p>
            <p className="text-[11px] text-slate-400 mt-1">Zoho inbox preview will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleEmails.map((email) => {
              const isImportant = email.attachments.length > 0 || /invoice|payment|delivery|sample|contract|urgent/i.test(email.subject + ' ' + email.body);
              return (
                <button
                  key={`${email.id}-${email.date}`}
                  type="button"
                  onClick={openPage}
                  className="w-full rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-left transition hover:border-blue-100 hover:bg-blue-50/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] font-bold text-slate-900 truncate">{email.subject || '(no subject)'}</p>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {new Date(email.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{email.from || 'Unknown sender'}</p>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{getEmailSnippet(email)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {isImportant && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Important</span>}
                      {email.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                          <Paperclip className="h-3 w-3" /> {email.attachments.length}
                        </span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-slate-300 mt-1" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default EmailPreviewSection;
