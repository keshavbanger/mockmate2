import React from 'react';
import { getName, getContactItems, dateRange, safeArr, filterSections, getCustomSection } from './templateUtils';

export default function AcademicTemplate({
  resume = {},
  settings = {},
  sectionOrder = [],
  hiddenSections = [],
  customSections = [],
}) {
  const pi = resume.personalInfo || {};
  const accent = settings.accentColor || '#5B21B6';
  const fontFamily = settings.font || 'Georgia, serif';
  const fontSize = settings.fontSize ? `${settings.fontSize}pt` : '10pt';

  const defaultOrder = ['education', 'experience', 'projects', 'summary', 'skills', 'certifications'];
  const rawOrder = sectionOrder.length > 0 ? sectionOrder : defaultOrder;
  const visibleOrder = filterSections(rawOrder, hiddenSections);

  const renderCustomSection = (csKey) => {
    const cs = getCustomSection(csKey, customSections);
    if (!cs || !safeArr(cs.items).length) return null;
    return (
      <div key={csKey} className="mb-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2" style={{ color: accent }}>{cs.name}</h2>
        <div className="space-y-3 text-xs">
          {cs.items.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between font-bold">
                <span>{item.title} {item.organization && `, ${item.organization}`}</span>
                {item.date && <span>{item.date}</span>}
              </div>
              {item.description && <p className="italic text-slate-700">{item.description}</p>}
              {safeArr(item.bullets).length > 0 && (
                <ul className="list-disc ml-4 space-y-0.5 text-slate-700">
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
    <div className="w-full bg-white text-slate-900 p-8 min-h-[1050px] shadow-sm font-serif" style={{ fontFamily, fontSize }}>
      <header className="border-b pb-4 mb-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">{getName(pi)}</h1>
        {pi.professionalTitle && <p className="text-xs font-semibold uppercase text-slate-600 mb-2">{pi.professionalTitle}</p>}
        <div className="flex justify-center flex-wrap gap-4 text-xs text-slate-600 italic">
          {getContactItems(pi).map((item, idx) => (
            <span key={idx}>{item}</span>
          ))}
        </div>
      </header>

      {visibleOrder.map(key => {
        if (key.startsWith('custom_')) return renderCustomSection(key);

        if (key === 'summary' && resume.summary) {
          return (
            <div key="summary" className="mb-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2" style={{ color: accent }}>Research Overview</h2>
              <p className="text-xs text-slate-800 leading-relaxed italic">{resume.summary}</p>
            </div>
          );
        }

        if (key === 'education' && safeArr(resume.education).length) {
          return (
            <div key="education" className="mb-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2" style={{ color: accent }}>Education</h2>
              <div className="space-y-3 text-xs">
                {safeArr(resume.education).map((edu, i) => (
                  <div key={i}>
                    <div className="flex justify-between font-bold">
                      <span>{edu.degree} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}</span>
                      <span>{dateRange(edu.startDate, edu.endDate)}</span>
                    </div>
                    <p className="italic text-slate-700">{edu.institution} {edu.location && `, ${edu.location}`}</p>
                    {edu.relevantCoursework && <p className="text-[11px] text-slate-600">Selected Coursework: {edu.relevantCoursework}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (key === 'experience' && safeArr(resume.experience).length) {
          return (
            <div key="experience" className="mb-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2" style={{ color: accent }}>Research & Teaching Experience</h2>
              <div className="space-y-3 text-xs">
                {safeArr(resume.experience).map((exp, i) => (
                  <div key={i}>
                    <div className="flex justify-between font-bold">
                      <span>{exp.jobTitle}, {exp.company}</span>
                      <span>{dateRange(exp.startDate, exp.endDate, exp.isCurrent)}</span>
                    </div>
                    <ul className="list-disc ml-4 space-y-0.5 text-slate-700">
                      {safeArr(exp.bullets).filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (key === 'projects' && safeArr(resume.projects).length) {
          return (
            <div key="projects" className="mb-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2" style={{ color: accent }}>Publications & Projects</h2>
              <div className="space-y-2 text-xs">
                {safeArr(resume.projects).map((proj, i) => (
                  <div key={i}>
                    <p className="font-bold text-slate-900">{proj.name}</p>
                    <p className="text-slate-700 italic">{proj.description}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (key === 'skills' && safeArr(resume.skills).length) {
          return (
            <div key="skills" className="mb-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1 mb-2" style={{ color: accent }}>Technical & Methodological Skills</h2>
              <div className="text-xs text-slate-800">
                {safeArr(resume.skills).map(s => s.skill).join(' · ')}
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
