// Shared between TechInterviewSetupPage (session-start form) and
// ProfilePage (account-level defaults for that same form) — kept in one
// place so the two pickers can't drift out of sync. Values here must match
// AuthService's VALID_ROLE_LEVELS/VALID_INTERVIEW_TYPES/VALID_COMPANY_STYLES/
// VALID_LANGUAGES on the backend.

export const ROLE_LEVELS = [
  { value: 'INTERN',  label: 'Intern' },
  { value: 'FRESHER', label: 'Fresher / New Grad' },
  { value: 'SDE_1',   label: 'SDE-1 (0–2 yrs)' },
  { value: 'SDE_2',   label: 'SDE-2 (2–5 yrs)' },
  { value: 'SDE_3',   label: 'SDE-3 / Staff (5+ yrs)' },
];

export const INTERVIEW_TYPES = [
  { value: 'BACKEND',      label: '⚙️ Backend' },
  { value: 'FRONTEND',     label: '🎨 Frontend' },
  { value: 'FULLSTACK',    label: '🔗 Full Stack' },
  { value: 'DATA_SCIENCE', label: '📊 Data Science' },
  { value: 'DEVOPS',       label: '🚀 DevOps' },
];

// GENERIC has no matching entry in InterviewEvaluationService's
// company-readiness formulas (Google/Amazon/Microsoft/Adobe/Startup) — that's
// intentional, it's the "no specific target" option and the Dashboard falls
// back to a blended score for it, not a crash.
export const COMPANY_STYLES = [
  { value: 'GOOGLE',    label: 'Google' },
  { value: 'AMAZON',    label: 'Amazon' },
  { value: 'MICROSOFT', label: 'Microsoft' },
  { value: 'STARTUP',   label: 'Startup' },
  { value: 'GENERIC',   label: 'Agnostic / Standard' },
];

export const LANGUAGES = [
  { value: 'java',       label: 'Java' },
  { value: 'python',     label: 'Python' },
  { value: 'cpp',        label: 'C++' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'go',         label: 'Go' },
];
