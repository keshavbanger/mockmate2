import React from 'react';
import { getName, getContactItems, dateRange, safeArr, filterSections, getCustomSection } from './templateUtils';

export default function ExecutiveTemplate({
  resume = {},
  settings = {},
  sectionOrder = [],
  hiddenSections = [],
  customSections = [],
}) {
  const pi = resume.personalInfo || {};
  const accent = settings.accentColor || '#1B3A4B';
  const fontFamily = settings.font || 'Inter, sans-serif';
  const fontSize = settings.fontSize ? `${settings.fontSize}pt` : '10pt';

  const defaultOrder = [
    'summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'achievements', 'languages'
  ];

  const rawOrder = sectionOrder.length > 0 ? sectionOrder : defaultOrder;
  const visibleOrder = filterSections(rawOrder, hiddenSections);

  const renderCustomSection = (csKey) => {
    const cs = getCustomSection(csKey, customSections);
    if (!cs || !safeArr(cs.items).length) return null;
    return (
      <div key={csKey}>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-3">{cs.name}</h2>
        <div className="space-y-3">
          {cs.items.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between items-baseline">
                <h3 className="text-xs font-bold text-slate-900">{item.title}</h3>
                {item.date && <span className="text-[11px] font-semibold text-slate-500">{item.date}</span>}
              </div>
              {item.organization && <p className="text-xs font-semibold text-slate-700 mb-1">{item.organization}</p>}
              {item.description && <p className="text-xs text-slate-700 leading-normal">{item.description}</p>}
              {safeArr(item.bullets).length > 0 && (
                <ul className="list-disc list-outside ml-4 space-y-1 text-xs text-slate-700 mt-1">
                  {item.bullets.filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-white text-slate-900 min-h-[1050px] shadow-sm font-sans" style={{ fontFamily, fontSize }}>
      <header className="p-8 text-white" style={{ backgroundColor: accent }}>
        <h1 className="text-3xl font-bold tracking-tight mb-1">{getName(pi)}</h1>
        {pi.professionalTitle && (
          <p className="text-sm font-medium text-slate-200 tracking-wider uppercase mb-4">{pi.professionalTitle}</p>
        )}
        <div className="flex flex-wrap gap-4 text-xs text-slate-200">
          {getContactItems(pi).map((item, idx) => (
            <span key={idx}>{item}</span>
          ))}
        </div>
      </header>

      <main className="p-8 space-y-6">
        {visibleOrder.map(key => {
          if (key.startsWith('custom_')) return renderCustomSection(key);

          if (key === 'summary' && resume.summary) {
            return (
              <div key="summary" className="bg-slate-50 p-4 rounded border-l-4" style={{ borderColor: accent }}>
                <p className="text-xs text-slate-700 leading-relaxed italic">{resume.summary}</p>
              </div>
            );
          }
          if (key === 'experience' && safeArr(resume.experience).length) {
            return (
              <div key="experience">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-3">Professional Experience</h2>
                <div className="space-y-4">
                  {safeArr(resume.experience).map((exp, i) => (
                    <div key={i}>
                      <div className="flex justify-between items-baseline">
                        <h3 className="text-xs font-bold text-slate-900">{exp.jobTitle}</h3>
                        <span className="text-[11px] font-semibold text-slate-500">{dateRange(exp.startDate, exp.endDate, exp.isCurrent)}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 mb-1">{exp.company} {exp.location && `· ${exp.location}`}</p>
                      <ul className="list-disc list-outside ml-4 space-y-1 text-xs text-slate-700">
                        {safeArr(exp.bullets).filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (key === 'education' && safeArr(resume.education).length) {
            return (
              <div key="education">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2">Education & Credentials</h2>
                <div className="space-y-2">
                  {safeArr(resume.education).map((edu, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <div><strong className="text-slate-900">{edu.institution}</strong> — {edu.degree}</div>
                      <span className="text-slate-500">{dateRange(edu.startDate, edu.endDate)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (key === 'skills' && safeArr(resume.skills).length) {
            return (
              <div key="skills">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2">Core Competencies</h2>
                <div className="flex flex-wrap gap-2">
                  {safeArr(resume.skills).map((sk, i) => (
                    <span key={i} className="text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded font-medium">{sk.skill}</span>
                  ))}
                </div>
              </div>
            );
          }
          if (key === 'projects' && safeArr(resume.projects).length) {
            return (
              <div key="projects">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2">Projects</h2>
                <div className="space-y-3">
                  {safeArr(resume.projects).map((proj, i) => (
                    <div key={i}>
                      <h3 className="text-xs font-bold text-slate-900">{proj.name}</h3>
                      <p className="text-[11px] text-slate-500 mb-1">{proj.technologies}</p>
                      <ul className="list-disc list-outside ml-4 space-y-1 text-xs text-slate-700">
                        {safeArr(proj.bullets).filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })}
      </main>
    </div>
  );
}
