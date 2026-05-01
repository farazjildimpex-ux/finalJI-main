"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, List, Link as LinkIcon,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const FONT_SIZES = ['12px', '13px', '14px', '15px', '16px', '18px', '20px', '24px'];
const TEXT_COLORS = [
  '#0f172a', '#1e40af', '#15803d', '#b91c1c', '#78350f', '#6d28d9', '#0e7490', '#374151',
];

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value, onChange, placeholder = 'Write your message…', minHeight = 220,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== value) {
      isInternalChange.current = true;
      el.innerHTML = value || '';
      isInternalChange.current = false;
    }
  }, [value]);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (el && !isInternalChange.current) {
      onChange(el.innerHTML);
    }
  }, [onChange]);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emit();
  };

  const setFontSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = e.target.value;
    exec('fontSize', '7');
    const els = editorRef.current?.querySelectorAll('font[size="7"]');
    els?.forEach((el) => {
      (el as HTMLElement).removeAttribute('size');
      (el as HTMLElement).style.fontSize = size;
    });
    emit();
  };

  const setColor = (color: string) => {
    exec('foreColor', color);
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) exec('createLink', url.startsWith('http') ? url : 'https://' + url);
  };

  return (
    <div className="border border-slate-300 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
        {/* Format */}
        <ToolBtn title="Bold" onClick={() => exec('bold')}><Bold className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn title="Italic" onClick={() => exec('italic')}><Italic className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn title="Underline" onClick={() => exec('underline')}><Underline className="h-3.5 w-3.5" /></ToolBtn>

        <div className="w-px h-5 bg-slate-300 mx-1" />

        {/* Font size */}
        <select
          className="text-[11px] font-semibold rounded px-1.5 py-0.5 border border-slate-200 bg-white text-slate-700 cursor-pointer focus:outline-none"
          defaultValue="14px"
          onChange={setFontSize}
          title="Font size"
        >
          {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="w-px h-5 bg-slate-300 mx-1" />

        {/* Color swatches */}
        <div className="flex items-center gap-0.5" title="Text colour">
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              onMouseDown={(e) => { e.preventDefault(); setColor(c); }}
              className="w-4 h-4 rounded-full border border-white shadow-sm hover:scale-110 transition"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        <div className="w-px h-5 bg-slate-300 mx-1" />

        {/* Align */}
        <ToolBtn title="Align left" onClick={() => exec('justifyLeft')}><AlignLeft className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn title="Align centre" onClick={() => exec('justifyCenter')}><AlignCenter className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn title="Align right" onClick={() => exec('justifyRight')}><AlignRight className="h-3.5 w-3.5" /></ToolBtn>

        <div className="w-px h-5 bg-slate-300 mx-1" />

        <ToolBtn title="Bullet list" onClick={() => exec('insertUnorderedList')}><List className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn title="Insert link" onClick={insertLink}><LinkIcon className="h-3.5 w-3.5" /></ToolBtn>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder}
        className="px-3 py-2.5 text-sm text-slate-800 outline-none overflow-y-auto"
        style={{
          minHeight,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          lineHeight: 1.6,
        }}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

const ToolBtn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({
  title, onClick, children,
}) => (
  <button
    type="button"
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    title={title}
    className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
  >
    {children}
  </button>
);

export default RichTextEditor;
