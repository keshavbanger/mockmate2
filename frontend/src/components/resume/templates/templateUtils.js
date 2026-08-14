/**
 * Shared resume rendering utilities used by all templates.
 * Templates import from here to stay DRY while being free to customize layouts.
 */

// Format a date string to display format
export function fmtDate(str) {
  if (!str) return '';
  if (str.toLowerCase() === 'present' || str.toLowerCase() === 'current') return 'Present';
  return str;
}

// Format date range
export function dateRange(start, end, isCurrent) {
  const s = fmtDate(start);
  const e = isCurrent ? 'Present' : fmtDate(end);
  if (!s && !e) return '';
  if (!s) return e;
  if (!e) return s;
  return `${s} – ${e}`;
}

// Get full name with fallback
export function getName(pi) {
  return pi?.fullName?.trim() || 'Your Name';
}

// Build contact line items (non-empty only)
export function getContactItems(pi) {
  return [
    pi?.email,
    pi?.phone,
    pi?.location,
    pi?.linkedin,
    pi?.github,
    pi?.portfolio || pi?.website,
  ].filter(Boolean);
}

// Skill list for a category
export function skillsForCategory(skills, category) {
  return skills
    .filter(s => (category ? s.category === category : true))
    .map(s => s.skill)
    .join(', ');
}

// All skills flattened
export function allSkillsFlat(skills) {
  return skills.map(s => s.skill).filter(Boolean).join(' · ');
}

// Safe array accessor
export function safeArr(val) {
  return Array.isArray(val) ? val : [];
}

// Filter visible sections according to sectionOrder and hiddenSections
export function filterSections(sectionOrder = [], hiddenSections = []) {
  const hiddenSet = new Set(hiddenSections);
  return sectionOrder.filter(key => !hiddenSet.has(key));
}

// Retrieve custom section by key (e.g. 'custom_xyz' -> returns custom section object)
export function getCustomSection(key, customSections = []) {
  if (!key.startsWith('custom_')) return null;
  const id = key.replace('custom_', '');
  return customSections.find(cs => cs.id === id) || null;
}

// Generate inline styles for section headings based on settings
export function getHeadingClasses(headingStyle = 'underline') {
  switch (headingStyle) {
    case 'leftbar':
      return 'border-l-4 pl-2';
    case 'underline':
      return 'border-b-2 pb-1';
    case 'none':
    default:
      return '';
  }
}

// A4 dimensions in pixels at 96dpi
export const A4 = { width: 794, minHeight: 1123 };
