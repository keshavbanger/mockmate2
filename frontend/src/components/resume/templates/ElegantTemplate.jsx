import React from 'react';
import { getName, getContactItems, dateRange, safeArr, filterSections, getCustomSection } from './templateUtils';

export default function ElegantTemplate({
  resume = {},
  settings = {},
  sectionOrder = [],
  hiddenSections = [],
  customSections = [],
}) {
  const pi = resume.personalInfo || {};
  const accent = settings.accentColor || '#7C5C3A';
  const fontFamily = settings.font || 'Georgia, serif';
  const fontSize = settings.fontSize ? `${settings.fontSize}pt` : '10pt';

  const defaultOrder = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications'];
  const rawOrder = sectionOrder.length > 0 ? sectionOrder : defaultOrder;
  const visibleOrder = filterSections(rawOrder, hiddenSections);

  const renderCustomSection = (csKey) => {
    const cs = getCustomSection(csKey, customSections);
    if (!cs || !safeArr(cs.items).length) return null;
    return (
      <div key={csKey} className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest border-b pb-1 mb-4 text-center" style={{ color: accent, borderColor: '#E7E5E4' }}>{cs.name}</h2>
        <div className="space-y-4">
          {cs.items.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between items-baseline text-xs">
                <h3 className="font-bold text-stone-900">{item.title}</h3>
                {item.date && <span className="italic text-stone-500">{item.date}</span>}
              </div>
              {item.organization && <p className="text-xs italic text-stone-600 mb-1">{item.organization}</p>}
              {item.description && <p className="text-xs text-stone-700 leading-relaxed mb-1">{item.description}</p>}
              {safeArr(item.bullets).length > 0 && (
                <ul className="list-disc ml-4 space-y-1 text-xs text-stone-700">
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
    <div className="w-full bg-[#FAF9F6] text-stone-900 p-10 min-h-[1050px] shadow-sm font-serif" style={{ fontFamily, fontSize }}>
      <header className="border-b-2 pb-5 mb-6 text-center" style={{ borderColor: accent }}>
        <h1 className="text-3xl font-normal tracking-wide text-stone-900 mb-1" style={{ color: accent }}>{getName(pi)}</h1>
        {pi.professionalTitle && <p className="text-xs font-semibold uppercase tracking-widest text-stone-600 mb-3">{pi.professionalTitle}</p>}
        <div className="flex justify-center flex-wrap gap-4 text-xs text-stone-600 italic">
          {getContactItems(pi).map((item, idx) => (
            <span key={idx}>{item}</span>
          ))}
        </div>
      </header>

      {visibleOrder.map(key => {
        if (key.startsWith('custom_')) return renderCustomSection(key);

        if (key === 'summary' && resume.summary) {
          return (
            <div key="summary" className="mb-6">
              <p className="text-xs text-stone-700 leading-relaxed text-center italic max-w-2xl mx-auto">{resume.summary}</p>
            </div>
          );
        }

        if (key === 'experience' && safeArr(resume.experience).length) {
          return (
            <div key="experience" className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-widest border-b pb-1 mb-4 text-center" style={{ color: accent, borderColor: '#E7E5E4' }}>Experience</h2>
              <div className="space-y-4">
                {safeArr(resume.experience).map((exp, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline text-xs">
                      <h3 className="font-bold text-stone-900">{exp.jobTitle}</h3>
                      <span className="italic text-stone-500">{dateRange(exp.startDate, exp.endDate, exp.isCurrent)}</span>
                    </div>
                    <p className="text-xs italic text-stone-600 mb-1">{exp.company}</p>
                    <ul className="list-disc ml-4 space-y-1 text-xs text-stone-700">
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
            <div key="education" className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-widest border-b pb-1 mb-3 text-center" style={{ color: accent, borderColor: '#E7E5E4' }}>Education</h2>
              <div className="space-y-2 text-xs">
                {safeArr(resume.education).map((edu, i) => (
                  <div key={i} className="flex justify-between">
                    <span><strong>{edu.degree}</strong> — {edu.institution}</span>
                    <span className="italic text-stone-500">{dateRange(edu.startDate, edu.endDate)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (key === 'skills' && safeArr(resume.skills).length) {
          return (
            <div key="skills" className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-widest border-b pb-1 mb-2 text-center" style={{ color: accent, borderColor: '#E7E5E4' }}>Skills</h2>
              <p className="text-xs text-stone-700 text-center italic">{safeArr(resume.skills).map(s => s.skill).join('  •  ')}</p>
            </div>
          );
        }

        if (key === 'projects' && safeArr(resume.projects).length) {
          return (
            <div key="projects" className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-widest border-b pb-1 mb-3 text-center" style={{ color: accent, borderColor: '#E7E5E4' }}>Projects</h2>
              <div className="space-y-3 text-xs">
                {safeArr(resume.projects).map((proj, i) => (
                  <div key={i}>
                    <div className="flex justify-between">
                      <strong className="text-stone-900">{proj.name}</strong>
                      <span className="italic text-stone-500">{dateRange(proj.startDate, proj.endDate)}</span>
                    </div>
                    {proj.technologies && <p className="italic text-stone-600 mb-1">{proj.technologies}</p>}
                    <ul className="list-disc ml-4 space-y-1 text-stone-700">
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
    </div>
  );
}
