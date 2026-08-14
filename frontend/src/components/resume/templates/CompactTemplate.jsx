import React from 'react';
import { getName, getContactItems, dateRange, safeArr, filterSections, getCustomSection } from './templateUtils';

export default function CompactTemplate({
  resume = {},
  settings = {},
  sectionOrder = [],
  hiddenSections = [],
  customSections = [],
}) {
  const pi = resume.personalInfo || {};
  const accent = settings.accentColor || '#0D6E6E';
  const fontFamily = settings.font || 'Inter, sans-serif';

  const defaultOrder = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications'];
  const rawOrder = sectionOrder.length > 0 ? sectionOrder : defaultOrder;
  const visibleOrder = filterSections(rawOrder, hiddenSections);

  const renderCustomSection = (csKey) => {
    const cs = getCustomSection(csKey, customSections);
    if (!cs || !safeArr(cs.items).length) return null;
    return (
      <div key={csKey} className="mb-3">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-900 border-b mb-1.5" style={{ color: accent }}>{cs.name}</h2>
        <div className="space-y-2">
          {cs.items.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between font-bold text-[11px]">
                <span>{item.title} — <span className="font-normal text-slate-700">{item.organization}</span></span>
                {item.date && <span className="text-[10px] font-semibold text-slate-500">{item.date}</span>}
              </div>
              {item.description && <p className="text-[10px] text-slate-700 leading-snug">{item.description}</p>}
              {safeArr(item.bullets).length > 0 && (
                <ul className="list-disc ml-3 space-y-0.5 text-[10px] text-slate-700">
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
    <div className="w-full bg-white text-slate-900 p-6 min-h-[1050px] shadow-sm font-sans text-xs" style={{ fontFamily }}>
      <header className="flex justify-between items-start border-b pb-2 mb-3" style={{ borderColor: accent }}>
        <div>
          <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">{getName(pi)}</h1>
          <p className="text-[11px] font-bold text-slate-600 uppercase">{pi.professionalTitle}</p>
        </div>
        <div className="text-right text-[10px] text-slate-600 space-y-0.5">
          {getContactItems(pi).map((item, idx) => (
            <p key={idx}>{item}</p>
          ))}
        </div>
      </header>

      {visibleOrder.map(key => {
        if (key.startsWith('custom_')) return renderCustomSection(key);

        if (key === 'summary' && resume.summary) {
          return (
            <p key="summary" className="text-[11px] text-slate-700 leading-snug mb-3 italic">{resume.summary}</p>
          );
        }
        if (key === 'experience' && safeArr(resume.experience).length) {
          return (
            <div key="experience" className="mb-3">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-900 border-b mb-1.5" style={{ color: accent }}>Work Experience</h2>
              <div className="space-y-2">
                {safeArr(resume.experience).map((exp, i) => (
                  <div key={i}>
                    <div className="flex justify-between font-bold text-[11px]">
                      <span>{exp.jobTitle} — <span className="font-normal text-slate-700">{exp.company}</span></span>
                      <span className="text-[10px] font-semibold text-slate-500">{dateRange(exp.startDate, exp.endDate, exp.isCurrent)}</span>
                    </div>
                    <ul className="list-disc ml-3 space-y-0.5 text-[10px] text-slate-700">
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
            <div key="education" className="mb-3">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-900 border-b mb-1" style={{ color: accent }}>Education</h2>
              {safeArr(resume.education).map((edu, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span><strong>{edu.degree}</strong>, {edu.institution}</span>
                  <span className="text-[10px] text-slate-500">{dateRange(edu.startDate, edu.endDate)}</span>
                </div>
              ))}
            </div>
          );
        }
        if (key === 'skills' && safeArr(resume.skills).length) {
          return (
            <div key="skills" className="mb-3">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-900 border-b mb-1" style={{ color: accent }}>Skills</h2>
              <p className="text-[10px] text-slate-700">{safeArr(resume.skills).map(s => s.skill).join(' • ')}</p>
            </div>
          );
        }
        if (key === 'projects' && safeArr(resume.projects).length) {
          return (
            <div key="projects" className="mb-3">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-900 border-b mb-1" style={{ color: accent }}>Projects</h2>
              {safeArr(resume.projects).map((proj, i) => (
                <div key={i} className="mb-1">
                  <div className="flex justify-between font-bold text-[11px]">
                    <span>{proj.name}</span>
                    <span className="text-[10px] text-slate-500">{dateRange(proj.startDate, proj.endDate)}</span>
                  </div>
                  {proj.technologies && <p className="text-[10px] text-slate-600">{proj.technologies}</p>}
                </div>
              ))}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
