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
          className={`text-sm leading-snug ${
            required ? 'text-rose-500' : 'text-gray-700'
          }`}
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

interface CollapsibleFormSectionProps {
  title: string;
  summary?: React.ReactNode;
  right?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const CollapsibleFormSection: React.FC<CollapsibleFormSectionProps> = ({
  title,
  summary,
  right,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`border rounded-lg bg-white transition-shadow ${open ? 'border-gray-200 shadow-sm' : 'border-gray-200'}`}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full px-4 sm:px-6 py-3 bg-gray-50 flex items-center justify-between gap-3 rounded-t-lg hover:bg-gray-100/80 active:bg-gray-100 transition-colors"
        style={{ borderRadius: open ? '0.5rem 0.5rem 0 0' : '0.5rem' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider shrink-0">{title}</h3>
          {!open && summary && (
            <span className="text-sm text-gray-500 truncate">{summary}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right && (
            <div onClick={e => e.stopPropagation()}>
              {right}
            </div>
          )}
          {open
            ? <ChevronUp className="h-4 w-4 text-gray-400" />
            : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>
      {open && <div className="divide-y divide-gray-100">{children}</div>}
    </div>
  );
};

export const formInputClass =
  'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors';

export const formInputReadOnlyClass =
  'block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 shadow-sm';
