/**
 * Mockmate Resume Optimization Analyzer
 * Four separate scoring categories + completeness + job matching.
 * All analysis is LOCAL — zero network calls.
 */

const ACTION_VERBS = new Set([
  'led','built','developed','implemented','designed','improved','increased','reduced',
  'managed','launched','created','optimized','architected','delivered','drove',
  'collaborated','established','maintained','integrated','deployed','automated',
  'migrated','refactored','mentored','scaled','shipped','wrote','analyzed','spearheaded',
  'engineered','streamlined','coordinated','facilitated','generated','produced',
  'oversaw','directed','supervised','negotiated','resolved','achieved','accelerated',
  'championed','consolidated','conceptualized','executed','initiated','introduced',
  'pioneered','revamped','transformed','upgraded'
]);

const STOP_WORDS = new Set([
  'and','the','for','with','that','this','are','you','will','our','your','have','but',
  'not','all','can','from','they','been','has','who','its','more','also','than','other',
  'into','about','would','such','these','their','each','any','was','were','when','what',
  'how','where','which','we','an','in','of','to','a','is','it','as','by','be','at','or'
]);

// ─── COMPLETENESS ─────────────────────────────────────────────────────────────

export function getCompletenessScore(resumeData) {
  const pi = resumeData.personalInfo || {};
  const checks = [
    { key: 'fullName',          label: 'Full Name',          done: !!pi.fullName?.trim() },
    { key: 'email',             label: 'Email',              done: !!pi.email?.trim() },
    { key: 'phone',             label: 'Phone',              done: !!pi.phone?.trim() },
    { key: 'location',          label: 'Location',           done: !!pi.location?.trim() },
    { key: 'linkedin',          label: 'LinkedIn',           done: !!pi.linkedin?.trim() },
    { key: 'summary',           label: 'Professional Summary', done: (resumeData.summary || '').trim().length > 30 },
    { key: 'experience',        label: 'Work Experience',    done: (resumeData.experience || []).length > 0 },
    { key: 'education',         label: 'Education',          done: (resumeData.education || []).length > 0 },
    { key: 'skills',            label: 'Skills',             done: (resumeData.skills || []).length >= 4 },
    { key: 'projects',          label: 'Projects',           done: (resumeData.projects || []).length > 0 },
    { key: 'certifications',    label: 'Certifications',     done: (resumeData.certifications || []).length > 0 },
  ];

  const done = checks.filter(c => c.done).length;
  const percent = Math.round((done / checks.length) * 100);

  const suggestions = checks
    .filter(c => !c.done)
    .map(c => getSuggestionFor(c.key));

  return { percent, checks, suggestions };
}

function getSuggestionFor(key) {
  const map = {
    fullName: 'Add your full name.',
    email: 'Add a professional email address.',
    phone: 'Add your phone number.',
    location: 'Add your city and country.',
    linkedin: 'Add your LinkedIn profile URL to increase recruiter visibility.',
    summary: 'Write a 3–4 sentence professional summary.',
    experience: 'Add at least one work experience entry.',
    education: 'Add your education background.',
    skills: 'List at least 4–6 relevant technical skills.',
    projects: 'Add 2–3 projects to showcase hands-on experience.',
    certifications: 'Add any relevant certifications if you have them.',
  };
  return map[key] || `Complete the "${key}" section.`;
}

// ─── CONTENT QUALITY ──────────────────────────────────────────────────────────

export function getContentQuality(resumeData) {
  const issues = [];
  const score_parts = [];

  const summary = resumeData.summary || '';
  const experience = resumeData.experience || [];

  // Summary checks
  if (summary.trim()) {
    const words = summary.trim().split(/\s+/);
    if (words.length < 20) issues.push('Summary is too short — aim for 40–80 words.');
    else if (words.length > 120) issues.push('Summary is too long — aim for 40–80 words.');
    else score_parts.push(15);

    const iWords = summary.toLowerCase().split(/\s+/);
    const iCount = iWords.filter(w => w === 'i' || w === "i'm" || w === "i've" || w === "i'll").length;
    if (iCount >= 3) issues.push('Summary uses too much first-person language (I, I\'ve, I\'m).');

    const genericPhrases = ['passionate about', 'team player', 'hardworking', 'go-getter', 'self-starter', 'results-driven'];
    genericPhrases.forEach(ph => {
      if (summary.toLowerCase().includes(ph)) {
        issues.push(`Summary contains generic phrase: "${ph}". Replace with specific achievements.`);
      }
    });
  }

  // Bullet quality
  let weakBullets = 0;
  let totalBullets = 0;

  experience.forEach(exp => {
    const bullets = (exp.bullets || []).filter(b => b?.trim());
    totalBullets += bullets.length;

    bullets.forEach(b => {
      const firstWord = b.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
      if (!ACTION_VERBS.has(firstWord)) weakBullets++;
      if (b.trim().length < 30) {
        issues.push(`Short bullet in "${exp.company || 'experience'}": "${b.substring(0, 40)}..." — add more detail.`);
      }
      if (b.trim().length > 200) {
        issues.push(`Long bullet in "${exp.company || 'experience'}" — consider splitting into two points.`);
      }
    });
  });

  if (totalBullets > 0 && weakBullets > totalBullets * 0.4) {
    issues.push(`${weakBullets} of ${totalBullets} bullets don't start with a strong action verb (e.g. "Led", "Built", "Improved").`);
  }

  const qualityScore = Math.max(0, 100 - (issues.length * 12));
  return { score: Math.min(100, qualityScore), issues };
}

// ─── FORMATTING COMPATIBILITY ─────────────────────────────────────────────────

export function getFormattingScore(resumeData) {
  const issues = [];
  const pi = resumeData.personalInfo || {};
  const experience = resumeData.experience || [];

  if (!pi.email?.trim()) issues.push('Missing email — required for ATS parsing.');
  if (!pi.phone?.trim()) issues.push('Missing phone number.');
  if (!pi.fullName?.trim()) issues.push('Missing name — ATS cannot identify the candidate.');

  // Date consistency
  experience.forEach(exp => {
    if (exp.startDate && exp.endDate && !exp.isCurrent) {
      // basic format check — not a deep validator
      if (exp.startDate === exp.endDate) {
        issues.push(`Experience at "${exp.company || 'a company'}": start and end dates are identical.`);
      }
    }
    if (!exp.startDate) {
      issues.push(`Missing start date for role at "${exp.company || 'a company'}".`);
    }
  });

  const score = Math.max(0, 100 - issues.length * 15);
  return { score: Math.min(100, score), issues };
}

// ─── MAIN ANALYZE ─────────────────────────────────────────────────────────────

export function analyzeResume(resumeData, jobDescription = '') {
  const completeness = getCompletenessScore(resumeData);
  const contentQuality = getContentQuality(resumeData);
  const formatting = getFormattingScore(resumeData);

  // Legacy combined score (kept for ATSAnalysisPanel compatibility)
  const score = Math.round(
    (completeness.percent * 0.35) +
    (contentQuality.score * 0.35) +
    (formatting.score * 0.30)
  );

  const issues = [...formatting.issues, ...contentQuality.issues];
  const suggestions = completeness.suggestions;

  let jdAnalysis = null;
  if (jobDescription?.trim()) {
    jdAnalysis = analyzeJobMatch(resumeData, jobDescription);
  }

  return {
    score,
    completenessPercent: completeness.percent,
    issues,
    suggestions,
    jdAnalysis,
    breakdown: {
      completeness: completeness.percent,
      contentQuality: contentQuality.score,
      formatting: formatting.score,
    },
    completenessChecks: completeness.checks,
  };
}

// ─── JOB DESCRIPTION MATCHING ────────────────────────────────────────────────

export function analyzeJobMatch(resumeData, jd) {
  const resumeText = buildResumeText(resumeData).toLowerCase();
  const jdKeywords = extractKeywords(jd);

  const matched = [];
  const missing = [];

  jdKeywords.forEach(kw => {
    if (resumeText.includes(kw.toLowerCase())) matched.push(kw);
    else missing.push(kw);
  });

  const matchPercentage = jdKeywords.length > 0
    ? Math.round((matched.length / jdKeywords.length) * 100)
    : 0;

  // Generate actionable recommendations
  const recommendations = missing.slice(0, 8).map(kw =>
    `If you have experience with "${kw}", consider adding it to your skills or experience section.`
  );

  return {
    matchPercentage,
    matched,
    missing: missing.slice(0, 15),
    totalKeywords: jdKeywords.length,
    recommendations,
  };
}

export function extractKeywords(text) {
  const words = text.match(/\b[\w.#+\-]{2,}\b/g) || [];
  const freq = {};

  words.forEach(w => {
    const lower = w.toLowerCase();
    if (lower.length > 2 && !STOP_WORDS.has(lower) && !/^\d+$/.test(lower)) {
      freq[lower] = (freq[lower] || 0) + 1;
    }
  });

  // Also force-include tech capitalized terms (React, Docker, etc.)
  const capTerms = text.match(/\b[A-Z][a-zA-Z.+#]{1,}\b/g) || [];
  capTerms.forEach(w => {
    if (!STOP_WORDS.has(w.toLowerCase()) && w.length > 1) {
      const lower = w.toLowerCase();
      freq[lower] = (freq[lower] || 0) + 2;
    }
  });

  return Object.entries(freq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word]) => word);
}

export function buildResumeText(data) {
  const parts = [];
  const pi = data.personalInfo || {};
  parts.push(pi.professionalTitle || '', pi.fullName || '');
  parts.push(data.summary || '');
  (data.experience || []).forEach(e => {
    parts.push(e.jobTitle || '', e.company || '', e.description || '', ...(e.bullets || []));
  });
  (data.skills || []).forEach(s => parts.push(s.skill || '', s.category || ''));
  (data.projects || []).forEach(p => parts.push(p.name || '', p.technologies || '', p.description || '', ...(p.bullets || [])));
  (data.education || []).forEach(e => parts.push(e.degree || '', e.fieldOfStudy || '', e.institution || ''));
  (data.certifications || []).forEach(c => parts.push(c.name || '', c.issuingOrganization || ''));
  (data.achievements || []).forEach(a => parts.push(a.title || '', a.description || ''));
  (data.customSections || []).forEach(cs => {
    parts.push(cs.name || '');
    (cs.items || []).forEach(item => parts.push(item.title || '', item.description || '', ...(item.bullets || [])));
  });
  return parts.filter(Boolean).join(' ');
}
