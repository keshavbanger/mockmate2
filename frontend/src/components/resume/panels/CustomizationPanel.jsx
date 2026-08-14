import React from 'react';
import { RotateCcw, Palette } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../../../utils/resumeDefaults';

const COLOR_PALETTES = [
  { name: 'Violet',   value: '#6B46C1' },
  { name: 'Navy',     value: '#1E3A5F' },
  { name: 'Blue',     value: '#2563EB' },
  { name: 'Teal',     value: '#0D9488' },
  { name: 'Emerald',  value: '#059669' },
  { name: 'Slate',    value: '#475569' },
  { name: 'Burgundy', value: '#7F1D1D' },
  { name: 'Black',    value: '#111827' },
  { name: 'Indigo',   value: '#4338CA' },
  { name: 'Rose',     value: '#9F1239' },
];

const FONTS = [
  'Inter', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Garamond', 'Roboto', 'Lato', 'Open Sans',
];

const HEADING_STYLES = [
  { value: 'underline', label: 'Underline' },
  { value: 'leftbar',   label: 'Left Bar' },
  { value: 'none',      label: 'Plain' },
];

const DIVIDER_STYLES = [
  { value: 'line', label: 'Solid Line' },
  { value: 'dots', label: 'Dotted' },
  { value: 'none', label: 'None' },
];

function SliderRow({ label, field, settings, onChange, min, max, step = 1, unit = '' }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600 font-semibold">{label}</span>
        <span className="text-slate-900 font-bold">{settings[field]}{unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={settings[field] ?? DEFAULT_SETTINGS[field]}
        onChange={e => onChange({ ...settings, [field]: parseFloat(e.target.value) })}
        className="w-full h-1.5 accent-purple-600 bg-slate-200 rounded-lg cursor-pointer"
      />
    </div>
  );
}

export default function CustomizationPanel({ settings = {}, onChange }) {
  const merged = { ...DEFAULT_SETTINGS, ...settings };

  const handleReset = () => onChange(DEFAULT_SETTINGS);

  return (
    <div className="space-y-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 text-purple-600 font-bold text-sm">
          <Palette className="w-4 h-4" /> Styling & Appearance
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-purple-600 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
        </button>
      </div>

      {/* Accent Color Palettes */}
      <div className="space-y-2.5">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Accent Color</p>
        <div className="flex flex-wrap gap-2.5">
          {COLOR_PALETTES.map(p => (
            <button
              key={p.value}
              title={p.name}
              onClick={() => onChange({ ...merged, accentColor: p.value })}
              className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 shadow-xs ${
                merged.accentColor === p.value ? 'border-purple-600 ring-2 ring-purple-500/30 scale-110' : 'border-white'
              }`}
              style={{ backgroundColor: p.value }}
            />
          ))}
        </div>
        {/* Custom color */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 font-medium">Custom:</span>
          <input
            type="color"
            value={merged.accentColor}
            onChange={e => onChange({ ...merged, accentColor: e.target.value })}
            className="w-8 h-6 bg-transparent border border-slate-200 rounded cursor-pointer"
          />
          <span className="text-xs text-slate-600 font-mono font-bold">{merged.accentColor}</span>
        </div>
      </div>

      {/* Font */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Font Family</p>
        <select
          value={merged.font}
          onChange={e => onChange({ ...merged, font: e.target.value })}
          className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500"
        >
          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Typography */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Typography</p>
        <SliderRow label="Body Font Size" field="fontSize" settings={merged} onChange={onChange} min={8} max={13} unit="pt" />
        <SliderRow label="Heading Size" field="headingSize" settings={merged} onChange={onChange} min={10} max={18} unit="pt" />
      </div>

      {/* Spacing */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Spacing</p>
        <SliderRow label="Line Spacing" field="lineSpacing" settings={merged} onChange={onChange} min={1.0} max={2.0} step={0.05} />
        <SliderRow label="Section Spacing" field="sectionSpacing" settings={merged} onChange={onChange} min={6} max={24} unit="px" />
        <SliderRow label="Top/Bottom Margins" field="margins" settings={{ margins: merged.margins?.top ?? 28 }} onChange={v => onChange({ ...merged, margins: { top: v.margins, right: merged.margins?.right ?? 32, bottom: v.margins, left: merged.margins?.left ?? 32 } })} min={10} max={48} unit="px" />
      </div>

      {/* Heading Style */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Heading Style</p>
        <div className="grid grid-cols-3 gap-2">
          {HEADING_STYLES.map(hs => (
            <button
              key={hs.value}
              onClick={() => onChange({ ...merged, headingStyle: hs.value })}
              className={`py-2 rounded-xl text-xs font-semibold transition ${
                merged.headingStyle === hs.value
                  ? 'bg-[#6B46C1] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
              }`}
            >
              {hs.label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider Style */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Divider Style</p>
        <div className="grid grid-cols-3 gap-2">
          {DIVIDER_STYLES.map(ds => (
            <button
              key={ds.value}
              onClick={() => onChange({ ...merged, dividerStyle: ds.value })}
              className={`py-2 rounded-xl text-xs font-semibold transition ${
                merged.dividerStyle === ds.value
                  ? 'bg-[#6B46C1] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
              }`}
            >
              {ds.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
