import React from 'react';
import { getName, getContactItems, dateRange, safeArr, filterSections, getCustomSection } from './templateUtils';

export default function CreativeTemplate({
  resume = {},
  settings = {},
  sectionOrder = [],
  hiddenSections = [],
  customSections = [],
}) {
  const pi = resume.personalInfo || {};
  const accent = settings.accentColor || '#C2410C';
  const fontFamily = settings.font || 'Inter, sans-serif';
  const fontSize = settings.fontSize ? `${settings.fontSize}pt` : '10pt';

  const defaultOrder = ['summary', 'experience', 'projects', 'education', 'skills', 'certifications'];
  const rawOrder = sectionOrder.length > 0 ? sectionOrder : defaultOrder;
  const visibleOrder = filterSections(rawOrder, hiddenSections);

  const renderCustomSection = (csKey) => {
    const cs = getCustomSection(csKey, customSections);
    if (!cs || !safeArr(cs.items).length) return null;
    return (
      <div key={csKey} className="bg-white p-6 rounded-lg shadow-sm mb-6">
        <h2 className="text-xs font-extrabold uppercase tracking-wider mb-4" style={{ color: accent }}>{cs.name}</h2>
        <div className="space-y-4">
          {cs.items.map((item, i) => (
            <div key={i} className="border-l-2 pl-4" style={{ borderColor: '#E2E8F0' }}>
              <div className="flex justify-between items-baseline">
                <h3 className="text-xs font-bold text-slate-900">{item.title}</h3>
                {item.date && <span className="text-[11px] font-semibold text-slate-400">{item.date}</span>}
              </div>
              {item.organization && <p className="text-xs text-slate-500 font-semibold mb-1">{item.organization}</p>}
              {item.description && <p className="text-xs text-slate-700 leading-relaxed mb-1">{item.description}</p>}
              {safeArr(item.bullets).length > 0 && (
                <ul className="list-disc ml-3 space-y-1 text-xs text-slate-700">
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
    <div className="w-full bg-slate-50 text-slate-900 p-8 min-h-[1050px] shadow-sm font-sans" style={{ fontFamily, fontSize }}>
      <header className="bg-white p-6 rounded-lg shadow-sm border-l-8 mb-6" style={{ borderColor: accent }}>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-1">{getName(pi)}</h1>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{pi.professionalTitle}</p>
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          {getContactItems(pi).map((item, idx) => (
            <span key={idx} className="bg-slate-100 px-2 py-0.5 rounded">{item}</span>
          ))}
        </div>
      </header>

      {visibleOrder.map(key => {
        if (key.startsWith('custom_')) return renderCustomSection(key);

        if (key === 'summary' && resume.summary) {
          return (
            <div key="summary" className="bg-white p-5 rounded-lg shadow-sm mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">About Me</h2>
              <p className="text-xs text-slate-700 leading-relaxed">{resume.summary}</p>
            </div>
          );
        }

        if (key === 'experience' && safeArr(resume.experience).length) {
          return (
            <div key="experience" className="bg-white p-6 rounded-lg shadow-sm mb-6">
              <h2 className="text-xs font-extrabold uppercase tracking-wider mb-4" style={{ color: accent }}>Work Experience</h2>
              <div className="space-y-4">
                {safeArr(resume.experience).map((exp, i) => (
                  <div key={i} className="border-l-2 pl-4" style={{ borderColor: '#E2E8F0' }}>
                    <div className="flex justify-between items-baseline">
                      <h3 className="text-xs font-bold text-slate-900">{exp.jobTitle}</h3>
                      <span className="text-[11px] font-semibold text-slate-400">{dateRange(exp.startDate, exp.endDate, exp.isCurrent)}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-semibold mb-1">{exp.company}</p>
                    <ul className="list-disc ml-3 space-y-1 text-xs text-slate-700">
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
            <div key="projects" className="bg-white p-6 rounded-lg shadow-sm mb-6">
              <h2 className="text-xs font-extrabold uppercase tracking-wider mb-4" style={{ color: accent }}>Projects</h2>
              <div className="space-y-3">
                {safeArr(resume.projects).map((proj, i) => (
                  <div key={i} className="border-l-2 pl-4" style={{ borderColor: '#E2E8F0' }}>
                    <div className="flex justify-between items-baseline">
                      <h3 className="text-xs font-bold text-slate-900">{proj.name}</h3>
                      <span className="text-[11px] font-semibold text-slate-400">{dateRange(proj.startDate, proj.endDate)}</span>
                    </div>
                    {proj.technologies && <p className="text-[11px] text-slate-500 mb-1">{proj.technologies}</p>}
                    <ul className="list-disc ml-3 space-y-1 text-xs text-slate-700">
                      {safeArr(proj.bullets).filter(Boolean).map((b, bi) => <li key={bi}>{b}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (key === 'education' && safeArr(resume.education).length) {
          return (
            <div key="education" className="bg-white p-5 rounded-lg shadow-sm mb-6">
              <h2 className="text-xs font-extrabold uppercase tracking-wider mb-3" style={{ color: accent }}>Education</h2>
              {safeArr(resume.education).map((edu, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span><strong>{edu.degree}</strong>, {edu.institution}</span>
                  <span className="text-slate-400">{dateRange(edu.startDate, edu.endDate)}</span>
                </div>
              ))}
            </div>
          );
        }

        if (key === 'skills' && safeArr(resume.skills).length) {
          return (
            <div key="skills" className="bg-white p-5 rounded-lg shadow-sm mb-6">
              <h2 className="text-xs font-extrabold uppercase tracking-wider mb-3" style={{ color: accent }}>Skills & Tools</h2>
              <div className="flex flex-wrap gap-2">
                {safeArr(resume.skills).map((sk, i) => (
                  <span key={i} className="text-xs text-white font-medium px-2.5 py-1 rounded" style={{ backgroundColor: accent }}>
                    {sk.skill}
                  </span>
                ))}
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
