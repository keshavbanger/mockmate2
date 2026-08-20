import ResumeSourcePicker from './ResumeSourcePicker.jsx';

/** "✓ Resume Parsed & Linked" pill — pairs with ResumeUploadCard in a step header, shown once uploadDone is true. */
export function ResumeParsedBadge() {
  return (
    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
      ✓ Resume Parsed & Linked
    </span>
  );
}

/**
 * The "pick a resume → parsing… → parsed summary" body for a Step 1 resume
 * card — originally SetupPage's inline pattern, extracted so every setup
 * screen that parses a resume (Interview Studio, Technical Interview Lab,
 * AI Interview Engine Beta) shows the identical result: avatar initial,
 * name, email + years of experience, skill pills, and a Replace Resume
 * button that hands control back to the picker.
 */
export default function ResumeUploadCard({ uploading, uploadDone, resumeData, onSourceChange, onReplace }) {
  if (uploading) {
    return (
      <div className="border-2 border-dashed border-purple-200 bg-purple-50/30 rounded-2xl p-6 flex flex-col items-center gap-3 py-4">
        <div className="h-6 w-6 rounded-full border-2 border-purple-200 border-t-[#6B46C1] animate-spin" />
        <p className="text-xs font-bold text-[#6B46C1]">Parsing and analyzing resume…</p>
      </div>
    );
  }

  if (!uploadDone) {
    return <ResumeSourcePicker onChange={onSourceChange} />;
  }

  const rd = resumeData;
  return (
    <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-[#6B46C1] text-white font-bold flex items-center justify-center text-lg shadow-md shrink-0">
          {rd?.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <h4 className="font-extrabold text-slate-900 text-sm">{rd?.name ?? 'Candidate Profile'}</h4>
          <p className="text-xs text-slate-500 font-medium">
            {rd?.email} · {rd?.total_experience_years ?? 0}y experience
          </p>
          {rd?.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {rd.skills.slice(0, 8).map((skill) => (
                <span key={skill} className="bg-white border border-purple-200 text-purple-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                  {skill}
                </span>
              ))}
              {rd.skills.length > 8 && (
                <span className="text-[9px] text-slate-400 font-bold px-1 py-0.5">
                  +{rd.skills.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onReplace}
        className="text-xs font-bold text-[#6B46C1] bg-white border border-purple-200 px-3.5 py-2 rounded-xl hover:bg-purple-50 transition-colors shrink-0"
      >
        Replace Resume
      </button>
    </div>
  );
}
