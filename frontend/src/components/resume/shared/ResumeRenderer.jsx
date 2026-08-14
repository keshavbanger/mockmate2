import React from 'react';
import { getTemplate } from '../templateRegistry';
import { DEFAULT_SECTION_ORDER, DEFAULT_SETTINGS } from '../../../utils/resumeDefaults';

/**
 * ResumeRenderer — decouples data from visual template.
 * Passes resume, settings, sectionOrder, hiddenSections, and customSections
 * to whichever template is active.
 */
export default function ResumeRenderer({
  resume = {},
  settings = {},
  templateId = 'modern',
  sectionOrder = DEFAULT_SECTION_ORDER,
  hiddenSections = [],
  customSections = [],
}) {
  const templateObj = getTemplate(templateId); // falls back to 'modern' on unknown id
  const Component  = templateObj?.component;

  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

  if (!Component) {
    return (
      <div className="p-8 text-red-500 text-sm">
        Template "{templateId}" not found. Please select a different template.
      </div>
    );
  }

  return (
    <Component
      resume={resume}
      settings={mergedSettings}
      sectionOrder={sectionOrder}
      hiddenSections={hiddenSections}
      customSections={customSections}
    />
  );
}
