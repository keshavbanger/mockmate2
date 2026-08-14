import React from 'react';
import { getName, getContactItems, dateRange, safeArr, filterSections, getCustomSection, getHeadingClasses } from './templateUtils';

export default function ModernTemplate({
  resume = {},
  settings = {},
  sectionOrder = [],
  hiddenSections = [],
  customSections = [],
}) {
  const pi = resume.personalInfo || {};
  const accent = settings.accentColor || '#6B46C1';
  const fontFamily = settings.font || 'Inter, sans-serif';
  const fontSize = settings.fontSize ? `${settings.fontSize}pt` : '10pt';
  const lineSpacing = settings.lineSpacing || 1.4;
  const sectionGap = settings.sectionSpacing ? `${settings.sectionSpacing}px` : '20px';
  const headingStyle = settings.headingStyle || 'underline';

  const margins = settings.margins || { top: 28, right: 32, bottom: 28, left: 32 };
  const paddingStyle = `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`;

  const defaultOrder = [
    'summary', 'experience', 'projects', 'education', 'skills', 'certifications', 'achievements', 'languages'
  ];

  const rawOrder = sectionOrder.length > 0 ? sectionOrder : defaultOrder;
  const visibleOrder = filterSections(rawOrder, hiddenSections);

  const headingClasses = getHeadingClasses(headingStyle);

  const renderCustomSection = (csKey) => {
    const cs = getCustomSection(csKey, customSections);
    if (!cs || !safeArr(cs.items).length) return null;
    return (
      <div key={csKey} style={{ marginBottom: sectionGap }}>
        <h2
          className={`text-xs font-bold uppercase tracking-wider mb-2 ${headingClasses}`}
          style={{ color: accent, borderColor: accent }}
        >
          {cs.name}
        </h2>
        <div className="space-y-3">
          {cs.items.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between items-baseline">
                <h3 className="text-xs font-bold text-slate-900">{item.title}</h3>
                {item.date && <span className="text-[11px] font-semibold text-slate-500">{item.date}</span>}
              </div>
              {item.organization && <p className="text-[11px] font-semibold text-slate-600 mb-1">{item.organization}</p>}
              {item.description && <p className="text-xs text-slate-700 leading-normal">{item.description}</p>}
              {safeArr(item.bullets).length > 0 && (
                <ul className="list-disc list-outside ml-3.5 space-y-1 text-xs text-slate-700 mt-1">
                  {item.bullets.filter(Boolean).map((b, bi) => (
                    <li key={bi} className="leading-normal">{b}</li>
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
            <h2
              className={`text-xs font-bold uppercase tracking-wider mb-2 ${headingClasses}`}
              style={{ color: accent, borderColor: accent }}
            >
              Professional Summary
            </h2>
            <p className="text-xs text-slate-700 leading-relaxed">{resume.summary}</p>
          </div>
        );

      case 'experience':
        if (!safeArr(resume.experience).length) return null;
        return (
          <div key="experience" style={{ marginBottom: sectionGap }}>
            <h2
              className={`text-xs font-bold uppercase tracking-wider mb-3 ${headingClasses}`}
              style={{ color: accent, borderColor: accent }}
            >
              Work Experience
            </h2>
            <div className="space-y-4">
              {safeArr(resume.experience).map((exp, i) => (
                <div key={i}>
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-xs font-bold text-slate-900">{exp.jobTitle}</h3>
                    <span className="text-[11px] font-semibold text-slate-500">{dateRange(exp.startDate, exp.endDate, exp.isCurrent)}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-[11px] text-slate-600 mb-1">
                    <span className="font-semibold">{exp.company}</span>
                    {exp.location && <span>{exp.location}</span>}
                  </div>
                  {safeArr(exp.bullets).length > 0 && (
                    <ul className="list-disc list-outside ml-3.5 space-y-1 text-xs text-slate-700">
                      {exp.bullets.filter(Boolean).map((b, bi) => (
                        <li key={bi} className="pl-0.5 leading-normal">{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'projects':
        if (!safeArr(resume.projects).length) return null;
        return (
          <div key="projects" style={{ marginBottom: sectionGap }}>
            <h2
              className={`text-xs font-bold uppercase tracking-wider mb-3 ${headingClasses}`}
              style={{ color: accent, borderColor: accent }}
            >
              Key Projects
            </h2>
            <div className="space-y-3">
              {safeArr(resume.projects).map((proj, i) => (
                <div key={i}>
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-xs font-bold text-slate-900">{proj.name}</h3>
                    <span className="text-[11px] text-slate-500">{dateRange(proj.startDate, proj.endDate)}</span>
                  </div>
                  {proj.technologies && (
                    <p className="text-[11px] font-medium text-slate-500 mb-1">Tech Stack: {proj.technologies}</p>
                  )}
                  {safeArr(proj.bullets).length > 0 && (
                    <ul className="list-disc list-outside ml-3.5 space-y-1 text-xs text-slate-700">
                      {proj.bullets.filter(Boolean).map((b, bi) => (
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
            <h2
              className={`text-xs font-bold uppercase tracking-wider mb-3 ${headingClasses}`}
              style={{ color: accent, borderColor: accent }}
            >
              Education
            </h2>
            <div className="space-y-3">
              {safeArr(resume.education).map((edu, i) => (
                <div key={i} className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{edu.institution}</h3>
                    <p className="text-xs text-slate-700">{edu.degree} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}</p>
                    {edu.relevantCoursework && (
                      <p className="text-[11px] text-slate-500 mt-0.5">Coursework: {edu.relevantCoursework}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-medium text-slate-500">{dateRange(edu.startDate, edu.endDate)}</span>
                    {edu.gpa && <p className="text-[11px] text-slate-600 font-semibold">GPA: {edu.gpa}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'skills':
        if (!safeArr(resume.skills).length) return null;
        return (
          <div key="skills" style={{ marginBottom: sectionGap }}>
            <h2
              className={`text-xs font-bold uppercase tracking-wider mb-2 ${headingClasses}`}
              style={{ color: accent, borderColor: accent }}
            >
              Skills & Expertise
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
              {safeArr(resume.skills).map((sk, i) => (
                <div key={i} className="flex items-baseline gap-1">
                  {sk.category && <span className="font-bold text-slate-900">{sk.category}:</span>}
                  <span>{sk.skill}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'certifications':
        if (!safeArr(resume.certifications).length) return null;
        return (
          <div key="certifications" style={{ marginBottom: sectionGap }}>
            <h2
              className={`text-xs font-bold uppercase tracking-wider mb-2 ${headingClasses}`}
              style={{ color: accent, borderColor: accent }}
            >
              Certifications
            </h2>
            <div className="space-y-1 text-xs text-slate-700">
              {safeArr(resume.certifications).map((cert, i) => (
                <div key={i} className="flex justify-between">
                  <span className="font-semibold text-slate-900">{cert.name} — <span className="font-normal text-slate-600">{cert.issuingOrganization}</span></span>
                  <span className="text-[11px] text-slate-500">{cert.issueDate}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'achievements':
        if (!safeArr(resume.achievements).length) return null;
        return (
          <div key="achievements" style={{ marginBottom: sectionGap }}>
            <h2
              className={`text-xs font-bold uppercase tracking-wider mb-2 ${headingClasses}`}
              style={{ color: accent, borderColor: accent }}
            >
              Key Achievements
            </h2>
            <ul className="list-disc list-outside ml-3.5 space-y-1 text-xs text-slate-700">
              {safeArr(resume.achievements).map((ach, i) => (
                <li key={i}>
                  <strong className="text-slate-900">{ach.title}: </strong>{ach.description}
                </li>
              ))}
            </ul>
          </div>
        );

      case 'languages':
        if (!safeArr(resume.languages).length) return null;
        return (
          <div key="languages" style={{ marginBottom: sectionGap }}>
            <h2
              className={`text-xs font-bold uppercase tracking-wider mb-2 ${headingClasses}`}
              style={{ color: accent, borderColor: accent }}
            >
              Languages
            </h2>
            <div className="flex flex-wrap gap-4 text-xs text-slate-700">
              {safeArr(resume.languages).map((lang, i) => (
                <span key={i}><strong className="text-slate-900">{lang.language}</strong> ({lang.proficiency})</span>
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
      className="w-full bg-white text-slate-800 min-h-[1050px] shadow-sm"
      style={{ fontFamily, fontSize, lineHeight: lineSpacing, padding: paddingStyle }}
    >
      {/* Header */}
      <header className="mb-6 border-b pb-4" style={{ borderColor: '#E2E8F0' }}>
        <h1 className="text-2xl font-extrabold uppercase tracking-tight mb-1" style={{ color: accent }}>
          {getName(pi)}
        </h1>
        {pi.professionalTitle && (
          <p className="text-sm font-bold text-slate-600 tracking-wide uppercase mb-3">{pi.professionalTitle}</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 font-medium">
          {getContactItems(pi).map((item, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              {idx > 0 && <span className="text-slate-300">•</span>}
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
