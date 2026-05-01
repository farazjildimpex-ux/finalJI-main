"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Mail, ChevronDown, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import type { EmailTemplate } from '../../types';
import type { EmailContext } from '../../lib/emailCompose';
import ComposeModal from './ComposeModal';

interface EmailButtonProps {
  /** The context type filters which templates are shown ('contract'|'letter'|'payment'). 'general' templates always shown. */
  contextType: EmailContext['type'];
  /** The data object for that context (contract, sample, debitNote record). */
  contextData: Record<string, any>;
  /** Optional pre-attached PDF (base64 string, no data: prefix). */
  pdfBase64?: string;
  pdfFileName?: string;
  /** Extra CSS classes on the trigger button. */
  className?: string;
}

const EmailButton: React.FC<EmailButtonProps> = ({
  contextType, contextData, pdfBase64, pdfFileName, className = '',
}) => {
  const { user } = useAuth();
  const [templates, setTemplates]               = useState<EmailTemplate[]>([]);
  const [dropdownOpen, setDropdownOpen]          = useState(false);
  const [selectedTemplate, setSelectedTemplate]  = useState<EmailTemplate | null>(null);
  const [loadingTemplates, setLoadingTemplates]  = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        // Show context-specific templates + general ones
        setTemplates(all.filter((t) => t.context === contextType || t.context === 'general'));
        setLoadingTemplates(false);
      });
  }, [user?.id, contextType]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const context: EmailContext = { type: contextType, data: contextData };

  return (
    <>
      <div className="relative inline-block" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((p) => !p)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 active:scale-95 transition ${className}`}
        >
          <Mail className="h-4 w-4" />
          Send email
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1.5 z-[200] w-64 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select template</p>
            </div>

            {loadingTemplates ? (
              <div className="p-3 text-xs text-slate-400">Loading templates…</div>
            ) : templates.length === 0 ? (
              <div className="p-3 text-center">
                <p className="text-xs text-slate-500 mb-2">No templates yet</p>
                <a href="/app/email-templates" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Create a template
                </a>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTemplate(t); setDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition"
                  >
                    <div className="text-xs font-bold text-slate-800">{t.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{t.subject}</div>
                    <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      t.context === 'general' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600'
                    }`}>{t.context}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-slate-100 px-3 py-2">
              <a href="/app/email-templates" className="text-[10px] text-blue-600 hover:underline font-bold">
                Manage templates →
              </a>
            </div>
          </div>
        )}
      </div>

      {selectedTemplate && (
        <ComposeModal
          template={selectedTemplate}
          context={context}
          pdfBase64={pdfBase64}
          pdfFileName={pdfFileName}
          onSent={() => setSelectedTemplate(null)}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </>
  );
};

export default EmailButton;
