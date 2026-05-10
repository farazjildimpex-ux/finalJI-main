import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save, RotateCcw, ChevronLeft, Eye, EyeOff, Upload, X,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Type, AlignLeft,
  AlignCenter, AlignRight, Minus, Plus
} from 'lucide-react';
import {
  loadPdfLayoutConfig, savePdfLayoutConfig, resetPdfLayoutConfig,
  DEFAULT_PDF_LAYOUT,
  type PdfLayoutConfig, type PdfSectionConfig, type PdfHeaderFooterConfig,
  type FontStyle, type TextAlign, type HeaderType, type FontFamily,
} from '../../utils/pdfLayoutConfig';

const PAGE_W = 210;
const PAGE_H = 297;
const PREVIEW_W = 380;
const SCALE = PREVIEW_W / PAGE_W;
const PREVIEW_H = Math.round(PAGE_H * SCALE);

const TAB_LABELS = ['sections', 'header', 'footer', 'page'] as const;
type Tab = typeof TAB_LABELS[number];

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

const AlignBtn: React.FC<{ val: TextAlign; current: TextAlign; onClick: (v: TextAlign) => void }> = ({ val, current, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(val)}
    className={`p-1.5 rounded-md border transition-colors ${current === val ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
  >
    {val === 'left' && <AlignLeft className="h-3.5 w-3.5" />}
    {val === 'center' && <AlignCenter className="h-3.5 w-3.5" />}
    {val === 'right' && <AlignRight className="h-3.5 w-3.5" />}
  </button>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
    <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
    <div className="flex-1">{children}</div>
  </div>
);

const NumberInput: React.FC<{ value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string }> = ({ value, onChange, min = -99, max = 99, step = 0.5, unit }) => (
  <div className="flex items-center gap-1">
    <button type="button" onClick={() => onChange(clamp(value - step, min, max))} className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100"><Minus className="h-3 w-3" /></button>
    <input
      type="number"
      value={value}
      step={step}
      min={min}
      max={max}
      onChange={e => onChange(clamp(parseFloat(e.target.value) || 0, min, max))}
      className="w-16 text-center text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
    <button type="button" onClick={() => onChange(clamp(value + step, min, max))} className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100"><Plus className="h-3 w-3" /></button>
    {unit && <span className="text-xs text-gray-400">{unit}</span>}
  </div>
);

const HeaderFooterEditor: React.FC<{
  config: PdfHeaderFooterConfig;
  onChange: (c: PdfHeaderFooterConfig) => void;
  label: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
}> = ({ config, onChange, label, fileInputRef }) => {
  const set = <K extends keyof PdfHeaderFooterConfig>(k: K, v: PdfHeaderFooterConfig[K]) =>
    onChange({ ...config, [k]: v });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() === 'jpg' ? 'jpg' : 'png';
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      const base64 = result.split(',')[1];
      onChange({ ...config, imageBase64: base64, imageExt: ext, type: 'image' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</p>

      {/* Type selector */}
      <Row label="Type">
        <div className="flex gap-1">
          {(['none', 'text', 'image'] as HeaderType[]).map(t => (
            <button key={t} type="button"
              onClick={() => set('type', t)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors capitalize ${config.type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            >{t}</button>
          ))}
        </div>
      </Row>

      {config.type === 'text' && (
        <>
          <Row label="Main text">
            <input value={config.text} onChange={e => set('text', e.target.value)} className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Company name…" />
          </Row>
          <Row label="Sub text">
            <input value={config.subText} onChange={e => set('subText', e.target.value)} className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Address / contact…" />
          </Row>
          <Row label="Main font size">
            <NumberInput value={config.fontSize} onChange={v => set('fontSize', v)} min={6} max={36} step={1} unit="pt" />
          </Row>
          <Row label="Sub font size">
            <NumberInput value={config.subFontSize} onChange={v => set('subFontSize', v)} min={6} max={24} step={1} unit="pt" />
          </Row>
          <Row label="Alignment">
            <div className="flex gap-1">
              <AlignBtn val="left" current={config.align} onClick={v => set('align', v)} />
              <AlignBtn val="center" current={config.align} onClick={v => set('align', v)} />
              <AlignBtn val="right" current={config.align} onClick={v => set('align', v)} />
            </div>
          </Row>
        </>
      )}

      {config.type === 'image' && (
        <>
          <Row label="Image">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold border border-dashed border-blue-400 text-blue-600 rounded-md hover:bg-blue-50">
                <Upload className="h-3.5 w-3.5" /> Upload
              </button>
              {config.imageBase64 && (
                <button type="button" onClick={() => set('imageBase64', null)} className="text-gray-400 hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {config.imageBase64 && <span className="text-[10px] text-green-600 font-semibold">✓ Uploaded</span>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageUpload} />
          </Row>
        </>
      )}

      {config.type !== 'none' && (
        <>
          <Row label="Height">
            <NumberInput value={config.height} onChange={v => set('height', v)} min={5} max={80} step={1} unit="mm" />
          </Row>
          <Row label="Gap after">
            <NumberInput value={config.yOffset} onChange={v => set('yOffset', v)} min={0} max={30} step={1} unit="mm" />
          </Row>
        </>
      )}
    </div>
  );
};

const SectionProperties: React.FC<{
  section: PdfSectionConfig;
  onChange: (s: PdfSectionConfig) => void;
}> = ({ section, onChange }) => {
  const set = <K extends keyof PdfSectionConfig>(k: K, v: PdfSectionConfig[K]) =>
    onChange({ ...section, [k]: v });
  return (
    <div className="space-y-1 mt-3 pt-3 border-t border-blue-100 bg-blue-50/40 rounded-lg p-3">
      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest mb-2">{section.label}</p>

      <Row label="Move down/up">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => set('yOffset', clamp(section.yOffset - 1, -60, 60))}
            className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100"><ArrowUp className="h-3 w-3" /></button>
          <button type="button" onClick={() => set('yOffset', clamp(section.yOffset + 1, -60, 60))}
            className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100"><ArrowDown className="h-3 w-3" /></button>
          <input type="number" value={section.yOffset} step={0.5}
            onChange={e => set('yOffset', clamp(parseFloat(e.target.value) || 0, -60, 60))}
            className="w-14 text-center text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <span className="text-xs text-gray-400">mm</span>
        </div>
      </Row>

      <Row label="Move right/left">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => set('xOffset', clamp(section.xOffset - 1, -40, 40))}
            className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100"><ArrowLeft className="h-3 w-3" /></button>
          <button type="button" onClick={() => set('xOffset', clamp(section.xOffset + 1, -40, 40))}
            className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100"><ArrowRight className="h-3 w-3" /></button>
          <input type="number" value={section.xOffset} step={0.5}
            onChange={e => set('xOffset', clamp(parseFloat(e.target.value) || 0, -40, 40))}
            className="w-14 text-center text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <span className="text-xs text-gray-400">mm</span>
        </div>
      </Row>

      <Row label="Font size">
        <NumberInput value={section.fontSize} onChange={v => set('fontSize', v)} min={6} max={24} step={0.5} unit="pt" />
      </Row>

      <Row label="Font style">
        <div className="flex gap-1">
          {(['normal', 'bold', 'italic'] as FontStyle[]).map(s => (
            <button key={s} type="button"
              onClick={() => set('fontStyle', s)}
              className={`px-2.5 py-1 text-xs font-semibold rounded border capitalize transition-colors ${section.fontStyle === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              style={{ fontStyle: s === 'italic' ? 'italic' : 'normal', fontWeight: s === 'bold' ? 'bold' : 'normal' }}
            >{s}</button>
          ))}
        </div>
      </Row>

      <Row label="Text align">
        <div className="flex gap-1">
          <AlignBtn val="left" current={section.align} onClick={v => set('align', v)} />
          <AlignBtn val="center" current={section.align} onClick={v => set('align', v)} />
          <AlignBtn val="right" current={section.align} onClick={v => set('align', v)} />
        </div>
      </Row>

      <div className="pt-1">
        <button type="button"
          onClick={() => onChange({ ...section, yOffset: 0, xOffset: 0, fontSize: DEFAULT_PDF_LAYOUT.sections.find(s => s.id === section.id)?.fontSize ?? section.fontSize, fontStyle: DEFAULT_PDF_LAYOUT.sections.find(s => s.id === section.id)?.fontStyle ?? section.fontStyle, align: 'left' })}
          className="text-[10px] text-gray-400 hover:text-red-500 underline"
        >Reset this section</button>
      </div>
    </div>
  );
};

const PdfLayoutEditor: React.FC = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<PdfLayoutConfig>(() => loadPdfLayoutConfig());
  const [activeTab, setActiveTab] = useState<Tab>('sections');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const headerFileRef = useRef<HTMLInputElement>(null);
  const footerFileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; startY: number; startOffset: number } | null>(null);

  const selectedSection = selectedId ? config.sections.find(s => s.id === selectedId) ?? null : null;

  const updateSection = useCallback((updated: PdfSectionConfig) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === updated.id ? updated : s),
    }));
  }, []);

  // Drag to reposition sections on preview
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = (e.clientY - dragRef.current.startY) / SCALE;
      const newOffset = clamp(Math.round((dragRef.current.startOffset + delta) * 2) / 2, -60, 60);
      setConfig(prev => ({
        ...prev,
        sections: prev.sections.map(s =>
          s.id === dragRef.current!.id ? { ...s, yOffset: newOffset } : s
        ),
      }));
    };
    const handleMouseUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleSave = () => {
    savePdfLayoutConfig(config);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const handleReset = () => {
    if (!confirm('Reset all layout settings to defaults?')) return;
    const defaults = resetPdfLayoutConfig();
    setConfig(defaults);
    setSelectedId(null);
  };

  // -- Preview rendering helpers --
  const headerH = config.header.type !== 'none' ? config.header.height : 0;
  const headerGap = config.header.type !== 'none' ? config.header.yOffset : 0;
  const footerH = config.footer.type !== 'none' ? config.footer.height : 0;
  const contentOffsetY = (headerH + headerGap) * SCALE;

  const getSectionPreviewStyle = (s: PdfSectionConfig): React.CSSProperties => {
    const topMm = headerH + headerGap + s._defaultY + s.yOffset;
    const leftMm = s._side === 'right'
      ? config.margin + (PAGE_W - 2 * config.margin) * 0.58 + s.xOffset
      : config.margin + s.xOffset;
    const widthMm = s._side === 'full'
      ? PAGE_W - 2 * config.margin
      : s._side === 'left'
        ? (PAGE_W - 2 * config.margin) * 0.56
        : (PAGE_W - 2 * config.margin) * 0.38;
    return {
      top: topMm * SCALE,
      left: leftMm * SCALE,
      width: widthMm * SCALE,
      height: s._defaultH * SCALE,
    };
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-bold text-gray-900">PDF Layout Editor</h1>
          <p className="text-[11px] text-gray-400">Drag sections on the preview or use the controls to adjust your contract PDF</p>
        </div>
        <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
        <button onClick={handleSave} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${savedMsg ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          <Save className="h-3.5 w-3.5" />
          {savedMsg ? 'Saved!' : 'Save'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left control panel ── */}
        <div className="w-72 xl:w-80 shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 shrink-0">
            {TAB_LABELS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors capitalize ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >{tab}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {/* SECTIONS TAB */}
            {activeTab === 'sections' && (
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 mb-2">Click a section to edit its properties. Drag bands on the preview to reposition.</p>
                {config.sections.map(section => {
                  const isSelected = section.id === selectedId;
                  return (
                    <div key={section.id}>
                      <div
                        onClick={() => setSelectedId(isSelected ? null : section.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-sm shrink-0 ${section._color}`} />
                        <span className={`flex-1 text-xs font-semibold truncate ${isSelected ? 'text-blue-800' : 'text-gray-700'}`}>{section.label}</span>
                        {(section.yOffset !== 0 || section.xOffset !== 0) && (
                          <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 rounded font-bold shrink-0">
                            {section.yOffset !== 0 ? `Y${section.yOffset > 0 ? '+' : ''}${section.yOffset}` : ''}{section.xOffset !== 0 ? ` X${section.xOffset > 0 ? '+' : ''}${section.xOffset}` : ''}
                          </span>
                        )}
                        <button type="button"
                          onClick={e => { e.stopPropagation(); updateSection({ ...section, visible: !section.visible }); }}
                          className="shrink-0 text-gray-400 hover:text-gray-700"
                        >
                          {section.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-red-400" />}
                        </button>
                      </div>
                      {isSelected && selectedSection && (
                        <SectionProperties section={selectedSection} onChange={updateSection} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* HEADER TAB */}
            {activeTab === 'header' && (
              <HeaderFooterEditor
                config={config.header}
                onChange={h => setConfig(prev => ({ ...prev, header: h }))}
                label="Page Header"
                fileInputRef={headerFileRef}
              />
            )}

            {/* FOOTER TAB */}
            {activeTab === 'footer' && (
              <HeaderFooterEditor
                config={config.footer}
                onChange={f => setConfig(prev => ({ ...prev, footer: f }))}
                label="Page Footer"
                fileInputRef={footerFileRef}
              />
            )}

            {/* PAGE TAB */}
            {activeTab === 'page' && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Page Settings</p>
                <Row label="Left / Right margin">
                  <NumberInput value={config.margin} onChange={v => setConfig(p => ({ ...p, margin: v }))} min={5} max={40} step={1} unit="mm" />
                </Row>
                <Row label="Label column width">
                  <NumberInput value={config.labelWidth} onChange={v => setConfig(p => ({ ...p, labelWidth: v }))} min={15} max={60} step={1} unit="mm" />
                </Row>
                <Row label="Line spacing">
                  <NumberInput value={config.lineSpacing} onChange={v => setConfig(p => ({ ...p, lineSpacing: v }))} min={0.8} max={2.0} step={0.1} />
                </Row>
                <Row label="Font family">
                  <div className="flex gap-1 flex-wrap">
                    {(['helvetica', 'times', 'courier'] as FontFamily[]).map(f => (
                      <button key={f} type="button"
                        onClick={() => setConfig(p => ({ ...p, fontFamily: f }))}
                        className={`px-2.5 py-1 text-xs font-semibold rounded border capitalize transition-colors ${config.fontFamily === f ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                        style={{ fontFamily: f === 'times' ? 'Georgia, serif' : f === 'courier' ? 'Courier, monospace' : 'Arial, sans-serif' }}
                      >
                        {f === 'helvetica' ? 'Helvetica' : f === 'times' ? 'Times' : 'Courier'}
                      </button>
                    ))}
                  </div>
                </Row>
              </div>
            )}
          </div>
        </div>

        {/* ── A4 Preview panel ── */}
        <div className="flex-1 overflow-auto bg-gray-200 flex items-start justify-center p-6">
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-semibold text-gray-500">
              A4 Preview — <span className="text-gray-400">drag bands to reposition · click to select</span>
            </p>

            {/* A4 page */}
            <div
              className="relative bg-white shadow-2xl rounded-sm border border-gray-300"
              style={{ width: PREVIEW_W, height: PREVIEW_H }}
            >
              {/* Header band */}
              {config.header.type !== 'none' && (
                <div
                  className="absolute inset-x-0 top-0 bg-gradient-to-b from-blue-100 to-blue-50 border-b-2 border-blue-300 flex items-center justify-center overflow-hidden"
                  style={{ height: config.header.height * SCALE }}
                >
                  {config.header.type === 'image' && config.header.imageBase64 ? (
                    <img
                      src={`data:image/${config.header.imageExt};base64,${config.header.imageBase64}`}
                      alt="Header"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center px-4">
                      <p className="font-bold text-blue-800 truncate" style={{ fontSize: Math.max(8, config.header.fontSize * SCALE * 0.5) }}>
                        {config.header.text || 'HEADER TEXT'}
                      </p>
                      {config.header.subText && (
                        <p className="text-blue-600 truncate mt-0.5" style={{ fontSize: Math.max(6, config.header.subFontSize * SCALE * 0.5) }}>
                          {config.header.subText}
                        </p>
                      )}
                    </div>
                  )}
                  <span className="absolute top-1 right-1 text-[8px] font-bold text-blue-400 uppercase tracking-wider">Header</span>
                </div>
              )}

              {/* Footer band */}
              {config.footer.type !== 'none' && (
                <div
                  className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-100 to-gray-50 border-t-2 border-gray-300 flex items-center justify-center overflow-hidden"
                  style={{ height: config.footer.height * SCALE }}
                >
                  {config.footer.type === 'image' && config.footer.imageBase64 ? (
                    <img
                      src={`data:image/${config.footer.imageExt};base64,${config.footer.imageBase64}`}
                      alt="Footer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <p className="text-gray-500 text-center truncate px-2" style={{ fontSize: Math.max(6, config.footer.fontSize * SCALE * 0.5) }}>
                      {config.footer.text || 'FOOTER TEXT'}
                    </p>
                  )}
                  <span className="absolute bottom-1 right-1 text-[8px] font-bold text-gray-400 uppercase tracking-wider">Footer</span>
                </div>
              )}

              {/* Section bands */}
              {config.sections.filter(s => s.visible).map(section => {
                const isSelected = section.id === selectedId;
                const style = getSectionPreviewStyle(section);
                return (
                  <div
                    key={section.id}
                    style={style}
                    className={`absolute flex items-center px-1.5 rounded-sm cursor-grab active:cursor-grabbing border transition-all select-none overflow-hidden ${
                      isSelected
                        ? 'ring-2 ring-blue-500 ring-offset-1 border-blue-400 z-20'
                        : 'border-transparent hover:border-gray-400 z-10'
                    } ${section._color} bg-opacity-70`}
                    onMouseDown={e => {
                      e.preventDefault();
                      setSelectedId(section.id);
                      setActiveTab('sections');
                      dragRef.current = { id: section.id, startY: e.clientY, startOffset: section.yOffset };
                    }}
                    onClick={() => { setSelectedId(section.id); setActiveTab('sections'); }}
                  >
                    <span className="text-[8px] font-bold text-gray-700 truncate leading-tight">
                      {section.label}
                    </span>
                    {(section.yOffset !== 0 || section.xOffset !== 0) && (
                      <span className="ml-auto shrink-0 text-[7px] bg-white/70 rounded px-0.5 text-gray-600 font-mono">
                        {section.yOffset !== 0 ? `↕${section.yOffset}` : ''}{section.xOffset !== 0 ? ` ↔${section.xOffset}` : ''}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Hidden sections indicator */}
              {config.sections.filter(s => !s.visible).length > 0 && (
                <div className="absolute bottom-2 left-2 text-[8px] text-gray-400 flex items-center gap-1">
                  <EyeOff className="h-2.5 w-2.5" />
                  {config.sections.filter(s => !s.visible).length} hidden
                </div>
              )}

              {/* Margin guide lines */}
              <div className="absolute inset-y-0 pointer-events-none" style={{ left: config.margin * SCALE, right: config.margin * SCALE, borderLeft: '1px dashed rgba(59,130,246,0.15)', borderRight: '1px dashed rgba(59,130,246,0.15)' }} />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 max-w-sm">
              {config.sections.map(s => (
                <div key={s.id} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-sm ${s._color} ${!s.visible ? 'opacity-30' : ''}`} />
                  <span className={`text-[9px] ${!s.visible ? 'text-gray-300 line-through' : 'text-gray-500'}`}>{s.label}</span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-gray-400 italic">
              Settings auto-apply to all new PDF exports from Contracts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfLayoutEditor;
