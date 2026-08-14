import React from 'react';
import { getName, getContactItems, dateRange, safeArr, filterSections, getCustomSection } from './templateUtils';

export default function ClassicTemplate({
  resume = {},
  settings = {},
  sectionOrder = [],
  hiddenSections = [],
  customSections = [],
}) {
  const pi = resume.personalInfo || {};
  const accent = settings.accentColor || '#1E3A5F';
  const fontFamily = settings.font || 'Georgia, serif';
  const fontSize = settings.fontSize ? `${settings.fontSize}pt` : '10pt';
  const lineSpacing = settings.lineSpacing || 1.4;
  const sectionGap = settings.sectionSpacing ? `${settings.sectionSpacing}px` : '16px';

  const margins = settings.margins || { top: 28, right: 32, bottom: 28, left: 32 };
  const paddingStyle = `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`;

  const defaultOrder = [
    'summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'achievements', 'languages'
  ];

  const rawOrder = sectionOrder.length > 0 ? sectionOrder : defaultOrder;
  const visibleOrder = filterSections(rawOrder, hiddenSections);

  const renderCustomSection = (csKey) => {
    const cs = getCustomSection(csKey, customSections);
    if (!cs || !safeArr(cs.items).length) return null;
    return (
      <div key={csKey} style={{ marginBottom: sectionGap }}>
        <h2 className="text-xs font-bold uppercase tracking-wider mb-1.5 pb-0.5 border-b text-center font-serif" style={{ color: accent, borderColor: '#CBD5E1' }}>
          {cs.name}
        </h2>
        <div className="space-y-3">
          {cs.items.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between items-baseline">
                <h3 className="text-xs font-bold text-slate-900">{item.title}</h3>
                {item.date && <span className="text-[11px] italic text-slate-600">{item.date}</span>}
              </div>
              {item.organization && <p className="text-[11px] italic text-slate-700 mb-1">{item.organization}</p>}
              {item.description && <p className="text-xs text-slate-800 leading-normal">{item.description}</p>}
              {safeArr(item.bullets).length > 0 && (
                <ul className="list-disc list-outside ml-4 space-y-0.5 text-xs text-slate-800 mt-1">
                  {item.bullets.filter(Boolean).map((b, bi) => (
                    <li key={bi}>{b}</li>
                  ))}
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
          <div key="summary" style={{ marginBottom: sectionGap }}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-1.5 pb-0.5 border-b text-center font-serif" style={{ color: accent, borderColor: '#CBD5E1' }}>
              Professional Summary
            </h2>
            <p className="text-xs text-slate-800 leading-relaxed text-justify">{resume.summary}</p>
          </div>
        );

      case 'experience':
        if (!safeArr(resume.experience).length) return null;
        return (
          <div key="experience" style={{ marginBottom: sectionGap }}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 pb-0.5 border-b text-center font-serif" style={{ color: accent, borderColor: '#CBD5E1' }}>
              Work Experience
            </h2>
            <div className="space-y-3">
              {safeArr(resume.experience).map((exp, i) => (
                <div key={i}>
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-xs font-bold text-slate-900">{exp.company} <span className="font-normal italic text-slate-600">— {exp.location}</span></h3>
                    <span className="text-[11px] italic text-slate-600">{dateRange(exp.startDate, exp.endDate, exp.isCurrent)}</span>
                  </div>
                  <div className="text-xs font-semibold italic text-slate-800 mb-1">{exp.jobTitle}</div>
                  {safeArr(exp.bullets).length > 0 && (
                    <ul className="list-disc list-outside ml-4 space-y-0.5 text-xs text-slate-800">
                      {exp.bullets.filter(Boolean).map((b, bi) => (
                        <li key={bi} className="leading-normal">{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'education':
        if (!safeArr(resume.education).length) return null;
        return (
          <div key="education" style={{ marginBottom: sectionGap }}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 pb-0.5 border-b text-center font-serif" style={{ color: accent, borderColor: '#CBD5E1' }}>
              Education
            </h2>
            <div className="space-y-2">
              {safeArr(resume.education).map((edu, i) => (
                <div key={i} className="flex justify-between items-baseline text-xs">
                  <div>
                    <strong className="text-slate-900">{edu.institution}</strong>, {edu.degree} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}
                    {edu.gpa && <span className="text-[11px] text-slate-600 italic font-normal"> (GPA: {edu.gpa})</span>}
                  </div>
                  <span className="text-[11px] italic text-slate-600">{dateRange(edu.startDate, edu.endDate)}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'skills':
        if (!safeArr(resume.skills).length) return null;
        return (
          <div key="skills" style={{ marginBottom: sectionGap }}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-1.5 pb-0.5 border-b text-center font-serif" style={{ color: accent, borderColor: '#CBD5E1' }}>
              Skills
            </h2>
            <div className="text-xs text-slate-800 space-y-1">
              {safeArr(resume.skills).map((sk, i) => (
                <div key={i}>
                  {sk.category && <strong className="text-slate-900">{sk.category}: </strong>}
                  <span>{sk.skill}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'projects':
        if (!safeArr(resume.projects).length) return null;
        return (
          <div key="projects" style={{ marginBottom: sectionGap }}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-2 pb-0.5 border-b text-center font-serif" style={{ color: accent, borderColor: '#CBD5E1' }}>
              Projects
            </h2>
            <div className="space-y-2">
              {safeArr(resume.projects).map((proj, i) => (
                <div key={i}>
                  <div className="flex justify-between items-baseline text-xs">
                    <strong className="text-slate-900">{proj.name}</strong>
                    <span className="text-[11px] italic text-slate-600">{dateRange(proj.startDate, proj.endDate)}</span>
                  </div>
                  {proj.technologies && <p className="text-[11px] italic text-slate-600 mb-0.5">Technologies: {proj.technologies}</p>}
                  {safeArr(proj.bullets).length > 0 && (
                    <ul className="list-disc list-outside ml-4 space-y-0.5 text-xs text-slate-800">
                      {proj.bullets.filter(Boolean).map((b, bi) => (
                        <li key={bi}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'certifications':
        if (!safeArr(resume.certifications).length) return null;
        return (
          <div key="certifications" style={{ marginBottom: sectionGap }}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-1.5 pb-0.5 border-b text-center font-serif" style={{ color: accent, borderColor: '#CBD5E1' }}>
              Certifications
            </h2>
            <div className="space-y-1 text-xs text-slate-800">
              {safeArr(resume.certifications).map((cert, i) => (
                <div key={i} className="flex justify-between">
                  <span><strong className="text-slate-900">{cert.name}</strong> — {cert.issuingOrganization}</span>
                  <span className="text-[11px] italic text-slate-600">{cert.issueDate}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'achievements':
        if (!safeArr(resume.achievements).length) return null;
        return (
          <div key="achievements" style={{ marginBottom: sectionGap }}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-1.5 pb-0.5 border-b text-center font-serif" style={{ color: accent, borderColor: '#CBD5E1' }}>
              Achievements
            </h2>
            <ul className="list-disc list-outside ml-4 space-y-0.5 text-xs text-slate-800">
              {safeArr(resume.achievements).map((ach, i) => (
                <li key={i}><strong className="text-slate-900">{ach.title}: </strong>{ach.description}</li>
              ))}
            </ul>
          </div>
        );

      case 'languages':
        if (!safeArr(resume.languages).length) return null;
        return (
          <div key="languages" style={{ marginBottom: sectionGap }}>
            <h2 className="text-xs font-bold uppercase tracking-wider mb-1.5 pb-0.5 border-b text-center font-serif" style={{ color: accent, borderColor: '#CBD5E1' }}>
              Languages
            </h2>
            <div className="flex justify-center flex-wrap gap-4 text-xs text-slate-800">
              {safeArr(resume.languages).map((lang, i) => (
                <span key={i}><strong>{lang.language}</strong> ({lang.proficiency})</span>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="w-full bg-white text-slate-900 min-h-[1050px] shadow-sm font-serif"
      style={{ fontFamily, fontSize, lineHeight: lineSpacing, padding: paddingStyle }}
    >
      {/* Header */}
      <header className="mb-5 text-center">
        <h1 className="text-2xl font-bold uppercase tracking-widest text-slate-900 mb-1" style={{ color: accent }}>
          {getName(pi)}
        </h1>
        {pi.professionalTitle && (
          <p className="text-xs font-semibold tracking-wider text-slate-700 uppercase mb-2">{pi.professionalTitle}</p>
        )}
        <div className="flex justify-center flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700 italic">
          {getContactItems(pi).map((item, idx) => (
            <span key={idx}>
              {idx > 0 && <span className="not-italic mr-3 text-slate-400">•</span>}
              {item}
            </span>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main>
        {visibleOrder.map(key => renderSection(key))}
      </main>
    </div>
  );
}
