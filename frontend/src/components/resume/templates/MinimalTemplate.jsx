import React from 'react';
import { getName, getContactItems, dateRange, safeArr, filterSections, getCustomSection } from './templateUtils';

export default function MinimalTemplate({
  resume = {},
  settings = {},
  sectionOrder = [],
  hiddenSections = [],
  customSections = [],
}) {
  const pi = resume.personalInfo || {};
  const fontFamily = settings.font || 'Inter, sans-serif';
  const fontSize = settings.fontSize ? `${settings.fontSize}pt` : '10pt';
  const lineSpacing = settings.lineSpacing || 1.4;
  const sectionGap = settings.sectionSpacing ? `${settings.sectionSpacing}px` : '24px';

  const margins = settings.margins || { top: 32, right: 36, bottom: 32, left: 36 };
  const paddingStyle = `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`;

  const defaultOrder = [
    'summary', 'experience', 'projects', 'education', 'skills', 'certifications', 'achievements', 'languages'
  ];

  const rawOrder = sectionOrder.length > 0 ? sectionOrder : defaultOrder;
  const visibleOrder = filterSections(rawOrder, hiddenSections);

  const renderCustomSection = (csKey) => {
    const cs = getCustomSection(csKey, customSections);
    if (!cs || !safeArr(cs.items).length) return null;
    return (
      <div key={csKey} style={{ marginBottom: sectionGap }}>
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">{cs.name}</h2>
        <div className="space-y-4">
          {cs.items.map((item, i) => (
            <div key={i} className="grid grid-cols-4 gap-4">
              <div className="col-span-1 text-[11px] font-medium text-slate-400">{item.date}</div>
              <div className="col-span-3">
                <h3 className="text-xs font-bold text-slate-900">{item.title}</h3>
                {item.organization && <div className="text-xs text-slate-500 font-medium mb-1">{item.organization}</div>}
                {item.description && <p className="text-xs text-slate-600 leading-relaxed mb-1">{item.description}</p>}
                {safeArr(item.bullets).length > 0 && (
                  <ul className="space-y-1 text-xs text-slate-600">
                    {item.bullets.filter(Boolean).map((b, bi) => (
                      <li key={bi} className="leading-relaxed">• {b}</li>
                    ))}
                  </ul>
                )}
              </div>
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
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">{resume.summary}</p>
          </div>
        );

      case 'experience':
        if (!safeArr(resume.experience).length) return null;
        return (
          <div key="experience" style={{ marginBottom: sectionGap }}>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Experience</h2>
            <div className="space-y-5">
              {safeArr(resume.experience).map((exp, i) => (
                <div key={i} className="grid grid-cols-4 gap-4">
                  <div className="col-span-1 text-[11px] font-medium text-slate-400">
                    {dateRange(exp.startDate, exp.endDate, exp.isCurrent)}
                  </div>
                  <div className="col-span-3">
                    <h3 className="text-xs font-bold text-slate-900">{exp.jobTitle}</h3>
                    <div className="text-xs text-slate-500 font-medium mb-1.5">{exp.company} {exp.location && `· ${exp.location}`}</div>
                    {safeArr(exp.bullets).length > 0 && (
                      <ul className="space-y-1 text-xs text-slate-600">
                        {exp.bullets.filter(Boolean).map((b, bi) => (
                          <li key={bi} className="leading-relaxed">• {b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'projects':
        if (!safeArr(resume.projects).length) return null;
        return (
          <div key="projects" style={{ marginBottom: sectionGap }}>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Projects</h2>
            <div className="space-y-4">
              {safeArr(resume.projects).map((proj, i) => (
                <div key={i} className="grid grid-cols-4 gap-4">
                  <div className="col-span-1 text-[11px] font-medium text-slate-400">
                    {dateRange(proj.startDate, proj.endDate)}
                  </div>
                  <div className="col-span-3">
                    <h3 className="text-xs font-bold text-slate-900">{proj.name}</h3>
                    {proj.technologies && <p className="text-[11px] text-slate-400 mb-1">{proj.technologies}</p>}
                    {safeArr(proj.bullets).length > 0 && (
                      <ul className="space-y-1 text-xs text-slate-600">
                        {proj.bullets.filter(Boolean).map((b, bi) => (
                          <li key={bi} className="leading-relaxed">• {b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'education':
        if (!safeArr(resume.education).length) return null;
        return (
          <div key="education" style={{ marginBottom: sectionGap }}>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Education</h2>
            <div className="space-y-3">
              {safeArr(resume.education).map((edu, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 text-xs">
                  <div className="col-span-1 text-[11px] text-slate-400">{dateRange(edu.startDate, edu.endDate)}</div>
                  <div className="col-span-3">
                    <strong className="text-slate-900">{edu.institution}</strong>
                    <p className="text-slate-600">{edu.degree} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}</p>
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
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Skills</h2>
            <div className="grid grid-cols-4 gap-4 text-xs">
              <div className="col-span-1 text-[11px] text-slate-400">Core Stack</div>
              <div className="col-span-3 flex flex-wrap gap-2">
                {safeArr(resume.skills).map((sk, i) => (
                  <span key={i} className="bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700 font-medium">{sk.skill}</span>
                ))}
              </div>
            </div>
          </div>
        );

      case 'certifications':
        if (!safeArr(resume.certifications).length) return null;
        return (
          <div key="certifications" style={{ marginBottom: sectionGap }}>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Certifications</h2>
            <div className="space-y-1 text-xs">
              {safeArr(resume.certifications).map((cert, i) => (
                <div key={i} className="grid grid-cols-4 gap-4">
                  <div className="col-span-1 text-[11px] text-slate-400">{cert.issueDate}</div>
                  <div className="col-span-3 text-slate-700"><strong>{cert.name}</strong> · {cert.issuingOrganization}</div>
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
    <div
      className="w-full bg-white text-slate-900 min-h-[1050px] shadow-sm font-sans"
      style={{ fontFamily, fontSize, lineHeight: lineSpacing, padding: paddingStyle }}
    >
      <header className="mb-8">
        <h1 className="text-3xl font-light tracking-tight text-slate-900 mb-1">
          {getName(pi)}
        </h1>
        {pi.professionalTitle && (
          <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase mb-4">{pi.professionalTitle}</p>
        )}
        <div className="flex flex-wrap gap-4 text-xs text-slate-400 font-normal">
          {getContactItems(pi).map((item, idx) => (
            <span key={idx}>{item}</span>
          ))}
        </div>
      </header>

      <main>
        {visibleOrder.map(key => renderSection(key))}
      </main>
    </div>
  );
}
