import React from 'react';
import { getName, getContactItems, dateRange, safeArr, filterSections, getCustomSection } from './templateUtils';

export default function ProfessionalTemplate({
  resume = {},
  settings = {},
  sectionOrder = [],
  hiddenSections = [],
  customSections = [],
}) {
  const pi = resume.personalInfo || {};
  const accent = settings.accentColor || '#1E4D8C';
  const fontFamily = settings.font || 'Inter, sans-serif';
  const fontSize = settings.fontSize ? `${settings.fontSize}pt` : '10pt';

  const defaultOrder = ['summary', 'experience', 'projects', 'education', 'skills', 'certifications'];
  const rawOrder = sectionOrder.length > 0 ? sectionOrder : defaultOrder;
  const visibleOrder = filterSections(rawOrder, hiddenSections);

  const isVisible = (key) => visibleOrder.includes(key) || (key.startsWith('custom_') && visibleOrder.includes(key));

  return (
    <div className="w-full bg-white text-slate-900 min-h-[1050px] shadow-sm font-sans flex" style={{ fontFamily, fontSize }}>
      {/* Sidebar */}
      <aside className="w-1/3 text-white p-6 space-y-6" style={{ backgroundColor: accent }}>
        <div>
          <h1 className="text-xl font-bold leading-tight mb-1">{getName(pi)}</h1>
          <p className="text-xs text-white/80 font-medium uppercase tracking-wider mb-4">{pi.professionalTitle}</p>
          <div className="space-y-1.5 text-xs text-white/90 break-all">
            {getContactItems(pi).map((item, idx) => (
              <p key={idx}>{item}</p>
            ))}
          </div>
        </div>

        {isVisible('skills') && safeArr(resume.skills).length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/70 border-b border-white/20 pb-1 mb-2">Skills</h2>
            <div className="space-y-1.5 text-xs text-white/90">
              {safeArr(resume.skills).map((sk, i) => (
                <div key={i}>
                  {sk.category && <p className="font-semibold">{sk.category}</p>}
                  <p className="text-white/80">{sk.skill}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {isVisible('education') && safeArr(resume.education).length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/70 border-b border-white/20 pb-1 mb-2">Education</h2>
            <div className="space-y-2 text-xs text-white/90">
              {safeArr(resume.education).map((edu, i) => (
                <div key={i}>
                  <p className="font-bold">{edu.degree}</p>
                  <p className="text-white/80">{edu.institution}</p>
                  <p className="text-[11px] text-white/60">{dateRange(edu.startDate, edu.endDate)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Main Body */}
      <main className="w-2/3 p-6 space-y-5">
        {isVisible('summary') && resume.summary && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2" style={{ color: accent }}>Profile</h2>
            <p className="text-xs text-slate-700 leading-relaxed">{resume.summary}</p>
          </div>
        )}

        {isVisible('experience') && safeArr(resume.experience).length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-3" style={{ color: accent }}>Experience</h2>
            <div className="space-y-4">
              {safeArr(resume.experience).map((exp, i) => (
                <div key={i}>
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-xs font-bold text-slate-900">{exp.jobTitle}</h3>
                    <span className="text-[11px] text-slate-500 font-medium">{dateRange(exp.startDate, exp.endDate, exp.isCurrent)}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-600 mb-1">{exp.company}</p>
                  <ul className="list-disc list-outside ml-3.5 space-y-1 text-xs text-slate-700">
                    {safeArr(exp.bullets).filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {isVisible('projects') && safeArr(resume.projects).length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2" style={{ color: accent }}>Projects</h2>
            <div className="space-y-3">
              {safeArr(resume.projects).map((proj, i) => (
                <div key={i}>
                  <h3 className="text-xs font-bold text-slate-900">{proj.name}</h3>
                  <p className="text-[11px] text-slate-500 mb-1">{proj.technologies}</p>
                  <ul className="list-disc list-outside ml-3.5 space-y-1 text-xs text-slate-700">
                    {safeArr(proj.bullets).filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom sections */}
        {visibleOrder.filter(k => k.startsWith('custom_')).map(csKey => {
          const cs = getCustomSection(csKey, customSections);
          if (!cs || !safeArr(cs.items).length) return null;
          return (
            <div key={csKey}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2" style={{ color: accent }}>{cs.name}</h2>
              <div className="space-y-3">
                {cs.items.map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline">
                      <h3 className="text-xs font-bold text-slate-900">{item.title}</h3>
                      {item.date && <span className="text-[11px] text-slate-500">{item.date}</span>}
                    </div>
                    {item.organization && <p className="text-[11px] text-slate-600 mb-1">{item.organization}</p>}
                    {item.description && <p className="text-xs text-slate-700 leading-normal">{item.description}</p>}
                    {safeArr(item.bullets).length > 0 && (
                      <ul className="list-disc list-outside ml-3.5 space-y-1 text-xs text-slate-700 mt-1">
                        {item.bullets.filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
