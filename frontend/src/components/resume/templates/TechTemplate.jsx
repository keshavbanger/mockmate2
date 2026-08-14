import React from 'react';
import { getName, getContactItems, dateRange, safeArr, filterSections, getCustomSection } from './templateUtils';

export default function TechTemplate({
  resume = {},
  settings = {},
  sectionOrder = [],
  hiddenSections = [],
  customSections = [],
}) {
  const pi = resume.personalInfo || {};
  const accent = settings.accentColor || '#0F766E';
  const fontSize = settings.fontSize ? `${settings.fontSize}pt` : '10pt';

  const defaultOrder = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'];
  const rawOrder = sectionOrder.length > 0 ? sectionOrder : defaultOrder;
  const visibleOrder = filterSections(rawOrder, hiddenSections);

  const renderCustomSection = (csKey) => {
    const cs = getCustomSection(csKey, customSections);
    if (!cs || !safeArr(cs.items).length) return null;
    return (
      <div key={csKey} className="mb-5">
        <h2 className="text-xs font-bold uppercase tracking-widest border-b border-slate-800 pb-1 mb-2" style={{ color: accent }}>
          [{cs.name.toUpperCase()}]
        </h2>
        <div className="space-y-3">
          {cs.items.map((item, i) => (
            <div key={i} className="bg-slate-900/30 p-3 rounded border border-slate-900">
              <div className="flex justify-between font-bold text-slate-200">
                <span>{item.title} {item.organization && `@ ${item.organization}`}</span>
                {item.date && <span className="text-slate-500 font-normal">{item.date}</span>}
              </div>
              {item.description && <p className="text-slate-400 mt-1">{item.description}</p>}
              {safeArr(item.bullets).length > 0 && (
                <ul className="list-disc ml-4 mt-2 space-y-1 text-slate-300">
                  {item.bullets.filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSection = (key) => {
    if (key.startsWith('custom_')) return renderCustomSection(key);

    switch (key) {
      case 'summary':
        if (!resume.summary) return null;
        return (
          <div key="summary" className="mb-5 bg-slate-900/50 p-3.5 rounded border border-slate-800">
            <p className="text-slate-300 leading-relaxed">// {resume.summary}</p>
          </div>
        );

      case 'skills':
        if (!safeArr(resume.skills).length) return null;
        return (
          <div key="skills" className="mb-5">
            <h2 className="text-xs font-bold uppercase tracking-widest border-b border-slate-800 pb-1 mb-2" style={{ color: accent }}>
              [SKILLS]
            </h2>
            <div className="flex flex-wrap gap-2">
              {safeArr(resume.skills).map((sk, i) => (
                <span key={i} className="bg-slate-900 text-teal-300 border border-slate-800 px-2 py-0.5 rounded text-[11px]">
                  {sk.category ? `${sk.category}: ` : ''}{sk.skill}
                </span>
              ))}
            </div>
          </div>
        );

      case 'experience':
        if (!safeArr(resume.experience).length) return null;
        return (
          <div key="experience" className="mb-5">
            <h2 className="text-xs font-bold uppercase tracking-widest border-b border-slate-800 pb-1 mb-3" style={{ color: accent }}>
              [EXPERIENCE]
            </h2>
            <div className="space-y-4">
              {safeArr(resume.experience).map((exp, i) => (
                <div key={i} className="bg-slate-900/30 p-3 rounded border border-slate-900">
                  <div className="flex justify-between font-bold text-slate-200">
                    <span>{exp.jobTitle} @ {exp.company}</span>
                    <span className="text-slate-500 font-normal">{dateRange(exp.startDate, exp.endDate, exp.isCurrent)}</span>
                  </div>
                  <ul className="list-disc ml-4 mt-2 space-y-1 text-slate-300">
                    {safeArr(exp.bullets).filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );

      case 'projects':
        if (!safeArr(resume.projects).length) return null;
        return (
          <div key="projects" className="mb-5">
            <h2 className="text-xs font-bold uppercase tracking-widest border-b border-slate-800 pb-1 mb-2" style={{ color: accent }}>
              [PROJECTS]
            </h2>
            <div className="space-y-3">
              {safeArr(resume.projects).map((proj, i) => (
                <div key={i}>
                  <div className="flex justify-between font-bold text-slate-200">
                    <span>{proj.name}</span>
                    <span className="text-slate-500 font-normal">{dateRange(proj.startDate, proj.endDate)}</span>
                  </div>
                  {proj.technologies && <p className="text-[11px]" style={{ color: accent }}>Tech: {proj.technologies}</p>}
                  <ul className="list-disc ml-4 space-y-1 text-slate-300 mt-1">
                    {safeArr(proj.bullets).filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );

      case 'education':
        if (!safeArr(resume.education).length) return null;
        return (
          <div key="education" className="mb-5">
            <h2 className="text-xs font-bold uppercase tracking-widest border-b border-slate-800 pb-1 mb-2" style={{ color: accent }}>
              [EDUCATION]
            </h2>
            <div className="space-y-2">
              {safeArr(resume.education).map((edu, i) => (
                <div key={i} className="flex justify-between text-slate-300">
                  <span><strong>{edu.institution}</strong> — {edu.degree} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}</span>
                  <span className="text-slate-500">{dateRange(edu.startDate, edu.endDate)}</span>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full bg-slate-950 text-slate-100 p-8 min-h-[1050px] shadow-sm font-mono text-xs" style={{ fontSize }}>
      <header className="border-b border-slate-800 pb-4 mb-5">
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: accent }}>&gt; {getName(pi)}</h1>
        {pi.professionalTitle && <p className="text-xs font-semibold text-slate-400 mb-3">// {pi.professionalTitle}</p>}
        <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
          {getContactItems(pi).map((item, idx) => (
            <span key={idx} className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{item}</span>
          ))}
        </div>
      </header>

      <main>
        {visibleOrder.map(key => renderSection(key))}
      </main>
    </div>
  );
}
