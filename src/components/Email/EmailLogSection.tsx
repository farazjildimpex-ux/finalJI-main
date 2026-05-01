"use client";

import React, { useEffect, useState } from 'react';
import { Mail, CheckCircle2, XCircle, ChevronDown, ChevronUp, MailOpen } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import type { EmailLog } from '../../types';

interface EmailLogSectionProps {
  contextType: string;
  contextId: string;
}

const EmailLogSection: React.FC<EmailLogSectionProps> = ({ contextType, contextId }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !contextId) return;
    setLoading(true);
    supabase
      .from('email_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('context_type', contextType)
      .eq('context_id', contextId)
      .order('sent_at', { ascending: false })
      .then(({ data }) => {
        setLogs((data || []) as EmailLog[]);
        setLoading(false);
      });
  }, [user?.id, contextType, contextId]);

  if (loading) return null;
  if (logs.length === 0) return null;

  return (
    <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
      >
        <span className="inline-flex items-center gap-2">
          <MailOpen className="h-4 w-4 text-blue-500" />
          Email history
          <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black">{logs.length}</span>
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="divide-y divide-slate-100">
          {logs.map((log) => (
            <div key={log.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {log.status === 'sent' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 truncate">{log.subject}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      To: {log.to_email.join(', ')}
                      {log.cc_email?.length > 0 && ` · CC: ${log.cc_email.join(', ')}`}
                    </p>
                    {log.attachment_name && (
                      <p className="text-[10px] text-slate-400 mt-0.5 inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {log.attachment_name}
                      </p>
                    )}
                    {log.status === 'failed' && log.error_message && (
                      <p className="text-[10px] text-red-600 mt-0.5">{log.error_message}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                    log.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {log.status}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {new Date(log.sent_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => setOpenId(openId === log.id ? null : log.id)}
                    className="text-[9px] text-blue-600 hover:underline font-bold"
                  >
                    {openId === log.id ? 'Hide body' : 'View body'}
                  </button>
                </div>
              </div>
              {openId === log.id && (
                <pre className="mt-2 p-3 bg-slate-50 rounded-xl text-[10px] text-slate-700 whitespace-pre-wrap font-mono border border-slate-200 max-h-32 overflow-y-auto">
                  {log.body}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailLogSection;
