/** Filler word patterns — ordered longest-first so multi-word phrases match first. */
export const FILLER_WORDS = [
  'you know',
  'kind of',
  'sort of',
  'you see',
  'i mean',
  'i guess',
  'um',
  'uh',
  'hmm',
  'err',
  'like',
  'basically',
  'actually',
  'literally',
  'right',
  'so',
  'well',
];

/** Regex patterns, pre-compiled */
export const FILLER_PATTERNS = FILLER_WORDS.map((word) => ({
  word,
  pattern: new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'gi'),
}));

/**
 * Count filler word occurrences in a text string.
 * @param {string} text
 * @returns {{ [word: string]: number }}
 */
export function countFillers(text) {
  if (!text) return {};
  const counts = {};
  for (const { word, pattern } of FILLER_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      counts[word] = (counts[word] ?? 0) + matches.length;
    }
  }
  return counts;
}

/**
 * Returns total count of all filler words found.
 * @param {{ [word: string]: number }} counts
 */
export function totalFillerCount(counts) {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

/**
 * Highlights filler words in plain text with <mark> spans.
 * Returns an array of React-renderable parts.
 * @param {string} text
 * @returns {Array<string|{filler: string, key: string}>}
 */
export function highlightFillers(text) {
  if (!text) return [text];

  // Build one combined regex with all filler words
  const combined = FILLER_WORDS.map((w) => `\\b${w.replace(/\s+/g, '\\s+')}\\b`).join('|');
  const regex = new RegExp(`(${combined})`, 'gi');

  const parts = [];
  let last = 0;
  let keyIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    parts.push({ filler: match[0], key: `filler-${keyIdx++}` });
    last = match.index + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * Estimate words per minute.
 * @param {string} text
 * @param {number} durationSeconds
 */
export function calcWPM(text, durationSeconds) {
  if (!text || durationSeconds <= 0) return 0;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((wordCount / durationSeconds) * 60);
}
