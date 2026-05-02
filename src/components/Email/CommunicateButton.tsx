"use client";

import React, { useEffect, useState } from 'react';
import { Mail, X, Send, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import type { EmailTemplate } from '../../types';
import type { EmailContext } from '../../lib/emailCompose';
import ComposeModal from './ComposeModal';

interface CommunicateButtonProps {
  contextType: EmailContext['type'];
  contextData: Record<string, any>;
  getPdfBase64?: () => Promise<{ base64: string; filename: string }>;
  className?: string;
}

const CommunicateButton: React.FC<CommunicateButtonProps> = ({
  contextType, contextData, getPdfBase64, className = '',
}) => {
  const { user } = useAuth();

  const [pickerOpen, setPickerOpen]           = useState(false);
  const [templates, setTemplates]             = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoadingTemplates(true);
    supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
      .then(({ data }) => {
        const all = (data || []) as EmailTemplate[];
        setTemplates(all.filter((t) => t.context === contextType || t.context === 'general'));
        setLoadingTemplates(false);
      });
  }, [user?.id, contextType]);

  const context: EmailContext = { type: contextType, data: contextData };

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={() => setPickerOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition shadow-sm ${className}`}
      >
        <Mail className="h-4 w-4" />
        Email
      </button>

      {/* ── Template picker modal ── */}
      {pickerOpen && !selectedTemplate && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900">Choose a template</h2>
                <p className="text-[10px] text-slate-500 mt-0.5">Select an email template to compose</p>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-80 overflow-y-auto">
              {loadingTemplates ? (
                <div className="flex items-center gap-2 px-5 py-6 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading templates…
                </div>
              ) : templates.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Mail className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 mb-3">No email templates yet</p>
                  <a
                    href="/app/email-templates"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create a template
                  </a>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTemplate(t); setPickerOpen(false); }}
                      className="w-full text-left px-5 py-3.5 hover:bg-blue-50 transition group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition truncate">
                            {t.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{t.subject}</p>
                        </div>
                        <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          t.context === 'general'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-blue-50 text-blue-600'
                        }`}>{t.context}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
              <a
                href="/app/email-templates"
                className="text-[10px] font-bold text-blue-600 hover:underline"
              >
                Manage templates →
              </a>
              <button
                onClick={() => setPickerOpen(false)}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Compose modal ── */}
      {selectedTemplate && (
        <ComposeModal
          template={selectedTemplate}
          context={context}
          getPdfBase64={getPdfBase64}
          onSent={() => setSelectedTemplate(null)}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </>
  );
};

export default CommunicateButton;
