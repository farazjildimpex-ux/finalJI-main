import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FormRowProps {
  label: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  alt?: boolean;
  hint?: React.ReactNode;
  rightOfLabel?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

const FormRow: React.FC<FormRowProps> = ({
  label,
  required,
  htmlFor,
  alt,
  hint,
  rightOfLabel,
  className = '',
  children,
}) => (
  <div className={`px-4 sm:px-6 py-3 ${alt ? 'bg-gray-50/60' : 'bg-white'} ${className}`}>
    <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr] sm:gap-4 items-start">
      <div className="flex items-center justify-between sm:block sm:pt-2 mb-1 sm:mb-0">
        <label
          htmlFor={htmlFor}
          className={`text-sm leading-snug ${required ? 'text-rose-500' : 'text-gray-700'}`}
        >
          {label}
        </label>
        {rightOfLabel && <div className="sm:hidden">{rightOfLabel}</div>}
      </div>
      <div className="min-w-0">
        <div className="max-w-xl">{children}</div>
        {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
        {rightOfLabel && <div className="hidden sm:block mt-2">{rightOfLabel}</div>}
      </div>
    </div>
  </div>
);

export default FormRow;

interface FormSectionProps {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  noHeader?: boolean;
}

export const FormSection: React.FC<FormSectionProps> = ({ title, right, children, noHeader }) => (
  <div className="border border-gray-200 rounded-lg bg-white">
    {!noHeader && title && (
      <div className="px-4 sm:px-6 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between rounded-t-lg">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</h3>
        {right}
      </div>
    )}
    <div className="divide-y divide-gray-100">{children}</div>
  </div>
);

export interface SummaryField {
  label: string;
  value: React.ReactNode;
}

interface CollapsibleFormSectionProps {
  title: string;
  summaryFields?: SummaryField[];
  right?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const CollapsibleFormSection: React.FC<CollapsibleFormSectionProps> = ({
  title,
  summaryFields,
  right,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const filled = (summaryFields || []).filter(
    f => f.value !== '' && f.value !== null && f.value !== undefined
  );

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">

      {/* ── Section header ── */}
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className={`w-full flex items-center justify-between px-4 sm:px-5 py-3.5 transition-colors group ${
          open
            ? 'bg-white border-b border-gray-100 hover:bg-gray-50/50'
            : 'bg-gray-50/60 hover:bg-gray-100/70'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Accent bar */}
          <span
            className={`shrink-0 w-[3px] h-[18px] rounded-full transition-colors ${
              open ? 'bg-blue-500' : 'bg-gray-300 group-hover:bg-gray-400'
            }`}
          />
          <span className="text-[13px] font-semibold text-gray-800 tracking-tight">{title}</span>
          {!open && filled.length > 0 && (
            <span className="text-[10px] font-semibold text-gray-400 bg-gray-200/60 px-1.5 py-0.5 rounded-full leading-none">
              {filled.length} field{filled.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {right && (
            <div onClick={e => e.stopPropagation()} className="flex items-center">
              {right}
            </div>
          )}
          <span className="text-[11px] text-gray-400 font-medium hidden sm:block">
            {open ? 'Collapse' : 'Expand'}
          </span>
          {open
            ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
            : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
        </div>
      </button>

      {/* ── Collapsed: compact field grid ── */}
      {!open && (
        <div className="bg-white border-t border-gray-100">
          {filled.length > 0 ? (
            <div className="px-4 sm:px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-4">
              {filled.map((field, i) => (
                <div key={i} className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5 leading-tight">
                    {field.label}
                  </p>
                  <p className="text-[12px] text-gray-800 leading-snug break-words font-medium">
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-5 py-3 text-xs text-gray-400 italic">No data entered yet</p>
          )}
        </div>
      )}

      {/* ── Expanded: full form rows ── */}
      {open && <div className="divide-y divide-gray-100">{children}</div>}
    </div>
  );
};

export const formInputClass =
  'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors';

export const formInputReadOnlyClass =
  'block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 shadow-sm';

export const zohoInputClass =
  'block w-full border border-gray-300 rounded-[3px] px-2.5 py-1 text-[13px] text-gray-800 bg-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-[3px] focus:ring-blue-500/10 transition-colors';

export const zohoTextareaClass =
  'block w-full border border-gray-300 rounded-[3px] px-2.5 py-1.5 text-[13px] text-gray-800 bg-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-[3px] focus:ring-blue-500/10 transition-colors resize-y';

export const zohoInputReadOnlyClass =
  'block w-full border border-gray-200 rounded-[3px] px-2.5 py-1 text-[13px] text-gray-500 bg-gray-50 cursor-default';

interface ZohoRowProps {
  label: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}

export const ZohoRow: React.FC<ZohoRowProps> = ({ label, required, htmlFor, hint, children, fullWidth }) => (
  <div className="px-6 py-2 grid grid-cols-1 sm:grid-cols-[190px_1fr] gap-x-5 items-start border-b border-gray-100 last:border-b-0">
    <label
      htmlFor={htmlFor}
      className={`text-[13px] leading-[30px] shrink-0 ${required ? 'text-[#c0392b]' : 'text-[#555]'}`}
    >
      {label}{required && <span className="text-[#c0392b]"> *</span>}
    </label>
    <div className={fullWidth ? 'w-full min-w-0' : 'max-w-[520px] min-w-0'}>
      {children}
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  </div>
);

interface ZohoSectionProps {
  title: string;
  right?: React.ReactNode;
}

export const ZohoSection: React.FC<ZohoSectionProps> = ({ title, right }) => (
  <div className="px-6 pt-3 pb-2 bg-gray-50 border-y border-gray-200 flex items-center justify-between">
    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</span>
    {right && <div className="flex items-center gap-2">{right}</div>}
  </div>
);

interface FGridProps {
  children: React.ReactNode;
  className?: string;
}

export const FGrid: React.FC<FGridProps> = ({ children, className = '' }) => (
  <div className={`px-4 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 ${className}`}>
    {children}
  </div>
);

interface FFieldProps {
  label: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  hint?: string;
  span?: 'full';
  children: React.ReactNode;
}

export const FField: React.FC<FFieldProps> = ({ label, required, htmlFor, hint, span, children }) => (
  <div className={span === 'full' ? 'sm:col-span-2' : ''}>
    <label
      htmlFor={htmlFor}
      className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1 leading-none"
    >
      {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    <div className="min-w-0">{children}</div>
    {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
  </div>
);
