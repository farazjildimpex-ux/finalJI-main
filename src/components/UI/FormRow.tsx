import React from 'react';

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
  <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
    {!noHeader && title && (
      <div className="px-4 sm:px-6 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</h3>
        {right}
      </div>
    )}
    <div className="divide-y divide-gray-100">{children}</div>
  </div>
);

export const formInputClass =
  'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors';

export const formInputReadOnlyClass =
  'block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 shadow-sm';
