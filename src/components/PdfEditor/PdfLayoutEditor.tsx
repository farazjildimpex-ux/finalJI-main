"use client";

import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, ChevronDown, ChevronRight, Save, RotateCcw } from 'lucide-react';
import {
  loadPdfLayoutConfig, savePdfLayoutConfig, resetPdfLayoutConfig,
  DEFAULT_FIELDS,
  type PdfLayoutConfig, type PdfFieldConfig, type FontStyle, type FontFamily, type HeaderType, type TextAlign,
} from '../../utils/pdfLayoutConfig';

const GROUPS = [
  'Header', 'Supplier', 'Contract Info', 'Introduction',
  'Buyer Info', 'Product Fields', 'Important Notes', 'Specs Table',
  'Delivery & Payment', 'Terms & Inspection', 'Closing', 'Signature Line',
];

const PdfLayoutEditor: React.FC = () => {
  const [config, setConfig] = useState<PdfLayoutConfig>(() => loadPdfLayoutConfig());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  const updateField = useCallback((id: string, updates: Partial<PdfFieldConfig>) => {
    setConfig(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === id ? { ...f, ...updates } : f),
    }));
  }, []);

  const updatePage = (key: keyof PdfLayoutConfig['page'], value: number | string) => {
    setConfig(prev => ({ ...prev, page: { ...prev.page, [key]: value } }));
  };

  const updateHeader = (key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, header: { ...prev.header, [key]: value } }));
  };

  const updateFooter = (key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, footer: { ...prev.footer, [key]: value } }));
  };

  const handleSave = () => {
    savePdfLayoutConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const fresh = resetPdfLayoutConfig();
    setConfig(fresh);
  };

  const fieldsForGroup = (group: string) => config.fields.filter(f => f.group === group);

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'text-xs font-semibold text-gray-500 block mb-1';

  return (
    <div className="min-h-full bg-gray-50/60">
      <div className="px-4 py-6 max-w-3xl mx-auto space-y-4 page-fade-in">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/app/settings" className="p-2 rounded-xl hover:bg-gray-200 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </Link>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500 mb-0.5">Settings</p>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">PDF Layout</h1>
              <p className="text-xs text-slate-500 mt-0.5">Customise every field printed in the contract PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>

        {/* Page Settings */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Page Settings</p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Left/Right Margin (mm)</label>
              <input type="number" value={config.page.margin} min={5} max={40}
                onChange={e => updatePage('margin', Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Label Column Width (mm)</label>
              <input type="number" value={config.page.labelWidth} min={20} max={60}
                onChange={e => updatePage('labelWidth', Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Line Spacing</label>
              <input type="number" value={config.page.lineSpacing} min={0.8} max={2.0} step={0.1}
                onChange={e => updatePage('lineSpacing', Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Font Family</label>
              <select value={config.page.fontFamily}
                onChange={e => updatePage('fontFamily', e.target.value as FontFamily)} className={inputCls}>
                <option value="helvetica">Helvetica (Sans-serif)</option>
                <option value="times">Times New Roman (Serif)</option>
                <option value="courier">Courier (Monospace)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Document Fields */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Document Fields</p>
          <p className="text-xs text-slate-500 mb-3">
            Click a group to expand it. Toggle the eye to show/hide a field, adjust font size with −/+, pick style with B/I/N, and rename the printed label text where applicable.
          </p>
          <div className="space-y-2">
            {GROUPS.map(group => {
              const fields = fieldsForGroup(group);
              if (fields.length === 0) return null;
              const hiddenCount = fields.filter(f => !f.visible).length;
              const isOpen = openGroups.has(group);
              return (
                <div key={group} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggleGroup(group)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen
                        ? <ChevronDown className="h-4 w-4 text-gray-400" />
                        : <ChevronRight className="h-4 w-4 text-gray-400" />
                      }
                      <span className="text-sm font-bold text-gray-800">{group}</span>
                      {hiddenCount > 0 && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-semibold">
                          {hiddenCount} hidden
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{fields.length} field{fields.length !== 1 ? 's' : ''}</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {fields.map(field => {
                        const defaultField = DEFAULT_FIELDS.find(d => d.id === field.id);
                        const hasCustomLabel = (defaultField?.customLabel ?? '') !== '';
                        return (
                          <div key={field.id} className={`px-4 py-3 transition-opacity ${!field.visible ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-2">
                              {/* Visibility toggle */}
                              <button
                                onClick={() => updateField(field.id, { visible: !field.visible })}
                                title={field.visible ? 'Hide field' : 'Show field'}
                                className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                                  field.visible ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'
                                }`}
                              >
                                {field.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                              </button>

                              {/* Field name */}
                              <span className="text-sm font-medium text-gray-700 flex-1 min-w-0 truncate">{field.label}</span>

                              {/* Font size */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => updateField(field.id, { fontSize: Math.max(6, +(field.fontSize - 0.5).toFixed(1)) })}
                                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-bold"
                                >−</button>
                                <span className="text-xs font-bold text-gray-700 w-9 text-center">{field.fontSize}pt</span>
                                <button
                                  onClick={() => updateField(field.id, { fontSize: Math.min(36, +(field.fontSize + 0.5).toFixed(1)) })}
                                  className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-bold"
                                >+</button>
                              </div>

                              {/* Font style B / I / N */}
                              <div className="flex items-center gap-0.5 shrink-0">
                                {(['bold', 'italic', 'normal'] as FontStyle[]).map(style => (
                                  <button
                                    key={style}
                                    onClick={() => updateField(field.id, { fontStyle: style })}
                                    title={style}
                                    className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-colors ${
                                      field.fontStyle === style
                                        ? 'bg-blue-600 text-white font-bold'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    {style === 'bold' ? 'B' : style === 'italic' ? 'I' : 'N'}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Data field font controls (shown for fields that have a value column) */}
                            {field.hasData && field.visible && (
                              <div className="mt-1.5 ml-9 flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-gray-400 shrink-0 w-9">Data:</span>
                                {/* Data font size */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => updateField(field.id, { dataFontSize: Math.max(6, +((field.dataFontSize ?? field.fontSize) - 0.5).toFixed(1)) })}
                                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-bold"
                                  >−</button>
                                  <span className="text-xs font-bold text-gray-700 w-9 text-center">{field.dataFontSize ?? field.fontSize}pt</span>
                                  <button
                                    onClick={() => updateField(field.id, { dataFontSize: Math.min(36, +((field.dataFontSize ?? field.fontSize) + 0.5).toFixed(1)) })}
                                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-bold"
                                  >+</button>
                                </div>
                                {/* Data font style B / I / N */}
                                <div className="flex items-center gap-0.5">
                                  {(['bold', 'italic', 'normal'] as FontStyle[]).map(style => (
                                    <button
                                      key={style}
                                      onClick={() => updateField(field.id, { dataFontStyle: style })}
                                      title={style}
                                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-colors ${
                                        (field.dataFontStyle ?? 'normal') === style
                                          ? 'bg-blue-600 text-white font-bold'
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                    >
                                      {style === 'bold' ? 'B' : style === 'italic' ? 'I' : 'N'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Label text override */}
                            {hasCustomLabel && field.visible && (
                              <div className="mt-1.5 ml-9 flex items-center gap-2">
                                <span className="text-xs text-gray-400 shrink-0 w-9">Label:</span>
                                <input
                                  type="text"
                                  value={field.customLabel}
                                  onChange={e => updateField(field.id, { customLabel: e.target.value })}
                                  placeholder={defaultField?.customLabel || ''}
                                  className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700"
                                />
                                {field.customLabel !== (defaultField?.customLabel ?? '') && (
                                  <button
                                    onClick={() => updateField(field.id, { customLabel: defaultField?.customLabel ?? '' })}
                                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 shrink-0"
                                  >reset</button>
                                )}
                              </div>
                            )}

                            {/* Position nudge controls */}
                            {field.visible && (
                              <div className="mt-2 ml-9 flex items-center gap-3 flex-wrap">
                                {/* Horizontal offset */}
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-gray-400 w-4 text-center">↔</span>
                                  <button
                                    onClick={() => updateField(field.id, { xOffset: +(field.xOffset - 1).toFixed(1) })}
                                    className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs font-bold"
                                  >←</button>
                                  <span className={`text-xs font-mono w-10 text-center ${field.xOffset !== 0 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                                    {field.xOffset > 0 ? `+${field.xOffset}` : field.xOffset}mm
                                  </span>
                                  <button
                                    onClick={() => updateField(field.id, { xOffset: +(field.xOffset + 1).toFixed(1) })}
                                    className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs font-bold"
                                  >→</button>
                                </div>

                                {/* Vertical offset */}
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-gray-400 w-4 text-center">↕</span>
                                  <button
                                    onClick={() => updateField(field.id, { yOffset: +(field.yOffset - 1).toFixed(1) })}
                                    className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs font-bold"
                                  >↑</button>
                                  <span className={`text-xs font-mono w-10 text-center ${field.yOffset !== 0 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                                    {field.yOffset > 0 ? `+${field.yOffset}` : field.yOffset}mm
                                  </span>
                                  <button
                                    onClick={() => updateField(field.id, { yOffset: +(field.yOffset + 1).toFixed(1) })}
                                    className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs font-bold"
                                  >↓</button>
                                </div>

                                {/* Reset position */}
                                {(field.xOffset !== 0 || field.yOffset !== 0) && (
                                  <button
                                    onClick={() => updateField(field.id, { xOffset: 0, yOffset: 0 })}
                                    className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-100"
                                  >reset pos</button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Header Settings */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Header</p>
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-4 space-y-3">
            <div>
              <label className={labelCls}>Type</label>
              <div className="flex gap-2">
                {(['none', 'text', 'image'] as HeaderType[]).map(t => (
                  <button key={t} onClick={() => updateHeader('type', t)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl capitalize transition-colors ${
                      config.header.type === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >{t}</button>
                ))}
              </div>
            </div>

            {config.header.type === 'text' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Company Name</label>
                    <input type="text" value={config.header.text}
                      onChange={e => updateHeader('text', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Alignment</label>
                    <select value={config.header.align}
                      onChange={e => updateHeader('align', e.target.value as TextAlign)} className={inputCls}>
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Sub Text (address / tagline)</label>
                  <input type="text" value={config.header.subText}
                    onChange={e => updateHeader('subText', e.target.value)} className={inputCls} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Main Font (pt)</label>
                    <input type="number" value={config.header.fontSize} min={8} max={36}
                      onChange={e => updateHeader('fontSize', Number(e.target.value))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Sub Font (pt)</label>
                    <input type="number" value={config.header.subFontSize} min={6} max={16}
                      onChange={e => updateHeader('subFontSize', Number(e.target.value))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Gap after (mm)</label>
                    <input type="number" value={config.header.yOffset} min={0} max={30}
                      onChange={e => updateHeader('yOffset', Number(e.target.value))} className={inputCls} />
                  </div>
                </div>
              </div>
            )}

            {config.header.type === 'image' && (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Header Image (PNG or JPG)</label>
                  <input type="file" accept="image/png,image/jpeg"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const ext = file.type === 'image/jpeg' ? 'jpg' : 'png';
                      const reader = new FileReader();
                      reader.onload = ev => {
                        const b64 = (ev.target?.result as string).split(',')[1];
                        updateHeader('imageBase64', b64);
                        updateHeader('imageExt', ext);
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {config.header.imageBase64 && <p className="text-xs text-green-600 mt-1 font-medium">✓ Image uploaded</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Height (mm)</label>
                    <input type="number" value={config.header.height} min={10} max={60}
                      onChange={e => updateHeader('height', Number(e.target.value))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Gap after (mm)</label>
                    <input type="number" value={config.header.yOffset} min={0} max={30}
                      onChange={e => updateHeader('yOffset', Number(e.target.value))} className={inputCls} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Settings */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Footer</p>
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-4 space-y-3">
            <div>
              <label className={labelCls}>Type</label>
              <div className="flex gap-2">
                {(['none', 'text', 'image'] as HeaderType[]).map(t => (
                  <button key={t} onClick={() => updateFooter('type', t)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl capitalize transition-colors ${
                      config.footer.type === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >{t}</button>
                ))}
              </div>
            </div>

            {config.footer.type === 'text' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Footer Text</label>
                    <input type="text" value={config.footer.text}
                      onChange={e => updateFooter('text', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Alignment</label>
                    <select value={config.footer.align}
                      onChange={e => updateFooter('align', e.target.value as TextAlign)} className={inputCls}>
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Font Size (pt)</label>
                    <input type="number" value={config.footer.fontSize} min={6} max={16}
                      onChange={e => updateFooter('fontSize', Number(e.target.value))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Height (mm)</label>
                    <input type="number" value={config.footer.height} min={10} max={40}
                      onChange={e => updateFooter('height', Number(e.target.value))} className={inputCls} />
                  </div>
                </div>
              </div>
            )}

            {config.footer.type === 'image' && (
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Footer Image (PNG or JPG)</label>
                  <input type="file" accept="image/png,image/jpeg"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const ext = file.type === 'image/jpeg' ? 'jpg' : 'png';
                      const reader = new FileReader();
                      reader.onload = ev => {
                        const b64 = (ev.target?.result as string).split(',')[1];
                        updateFooter('imageBase64', b64);
                        updateFooter('imageExt', ext);
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {config.footer.imageBase64 && <p className="text-xs text-green-600 mt-1 font-medium">✓ Image uploaded</p>}
                </div>
                <div>
                  <label className={labelCls}>Height (mm)</label>
                  <input type="number" value={config.footer.height} min={10} max={40}
                    onChange={e => updateFooter('height', Number(e.target.value))} className={inputCls} />
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PdfLayoutEditor;
