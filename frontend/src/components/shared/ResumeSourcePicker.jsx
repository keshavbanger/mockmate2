import { useState, useEffect, useRef } from 'react';
import { useSavedResumes } from '../../hooks/useSavedResumes';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function validateFile(f) {
  const name = f.name.toLowerCase();
  if (!name.endsWith('.pdf') && !name.endsWith('.docx')) return 'Only PDF and DOCX files are supported.';
  if (f.size > MAX_FILE_SIZE) return `File is too large (${(f.size / 1024 / 1024).toFixed(1)} MB) — max size is 10 MB.`;
  return null;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Shared "where does the resume come from" widget — replaces the 4
 * independently-implemented upload dropzones across SetupPage,
 * TechInterviewSetupPage, ATSUploadPage, and ResumeDashboardPage's import
 * flow. Reports the chosen source back to the parent via onChange:
 *   { mode: 'saved', savedResumeId }
 *   { mode: 'upload', file, saveAsResume, label }
 * The parent keeps its own submit logic — this only owns the source choice.
 */
export default function ResumeSourcePicker({ onChange, error: externalError }) {
  const { resumes, loading, reload } = useSavedResumes();
  const [mode, setMode] = useState('upload'); // 'saved' | 'upload'
  const [selectedId, setSelectedId] = useState(null);
  const [file, setFile] = useState(null);
  const [saveAsResume, setSaveAsResume] = useState(true);
  const [label, setLabel] = useState('');
  const [localError, setLocalError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const initializedRef = useRef(false);

  // Once resumes load, default to the saved picker (default resume
  // preselected) if any exist — otherwise fall straight to upload mode.
  useEffect(() => {
    if (initializedRef.current || loading) return;
    initializedRef.current = true;
    if (resumes.length > 0) {
      const def = resumes.find((r) => r.isDefault) || resumes[0];
      setMode('saved');
      setSelectedId(def.id);
    }
  }, [loading, resumes]);

  useEffect(() => {
    if (mode === 'saved' && selectedId) {
      onChange?.({ mode: 'saved', savedResumeId: selectedId });
    } else if (mode === 'upload') {
      onChange?.({ mode: 'upload', file, saveAsResume, label });
    } else {
      onChange?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedId, file, saveAsResume, label]);

  const validate = (f) => {
    const err = validateFile(f);
    if (err) { setLocalError(err); return; }
    setLocalError(null);
    setFile(f);
  };

  const hasSaved = resumes.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {hasSaved && mode === 'saved' && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Use a saved resume</p>
          <div className="flex flex-col gap-2">
            {resumes.map((r) => (
              <label
                key={r.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                  ${selectedId === r.id
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-light)]/40'
                    : 'border-black/10 bg-white hover:border-[var(--brand-primary)]/50'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="radio"
                    name="saved-resume"
                    checked={selectedId === r.id}
                    onChange={() => setSelectedId(r.id)}
                    className="accent-[var(--brand-primary)]"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-800 truncate">{r.label || r.fileName}</p>
                    <p className="text-[11px] text-slate-400">{r.fileName} · uploaded {formatDate(r.uploadedAt)}</p>
                  </div>
                </div>
                {r.isDefault && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">Default</span>
                )}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setMode('upload'); setSelectedId(null); }}
            className="self-start text-xs font-semibold text-[var(--brand-primary)] hover:underline"
          >
            Upload a different resume instead
          </button>
        </div>
      )}

      {mode === 'upload' && (
        <div className="flex flex-col gap-3">
          {hasSaved && (
            <button
              type="button"
              onClick={() => { setMode('saved'); const def = resumes.find((r) => r.isDefault) || resumes[0]; setSelectedId(def?.id || null); }}
              className="self-start text-xs font-semibold text-[var(--brand-primary)] hover:underline"
            >
              ← Use a saved resume instead
            </button>
          )}
          <div
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) validate(f); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed
              transition-all duration-300 cursor-pointer overflow-hidden
              ${dragging ? 'border-[var(--brand-primary)] bg-[var(--brand-light)]' :
                file ? 'border-emerald-400 bg-emerald-50/60' :
                'border-black/10 bg-white hover:border-[var(--brand-primary)] hover:bg-[var(--brand-light)]/40'}
              shadow-sm`}
          >
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) validate(f); }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {file ? (
              <>
                <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center text-xl">📄</div>
                <p className="font-bold text-emerald-700 text-sm text-center leading-tight">{file.name}</p>
                <p className="text-[10px] text-slate-400 font-semibold">{(file.size / 1024).toFixed(1)} KB · Click to replace</p>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl">📄</div>
                <p className="font-bold text-slate-600 text-sm text-center">Drop your resume here, or click to browse</p>
                <p className="text-[10px] text-slate-400 font-semibold">PDF or DOCX · Max 10 MB</p>
              </>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
            <input
              type="checkbox"
              checked={saveAsResume}
              onChange={(e) => setSaveAsResume(e.target.checked)}
              className="accent-[var(--brand-primary)]"
            />
            Save this resume for future use
          </label>
          {saveAsResume && (
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional) — e.g. Backend Resume"
              className="text-sm px-3 py-2 rounded-lg border border-black/10 focus:border-[var(--brand-primary)] outline-none"
            />
          )}
        </div>
      )}

      {(localError || externalError) && (
        <p className="text-xs font-semibold text-red-600">{localError || externalError}</p>
      )}
    </div>
  );
}
