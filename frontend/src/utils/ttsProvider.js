// The Web Speech API has no standardized, reliable "gender" field on
// SpeechSynthesisVoice — this is a name-based heuristic covering the voice
// sets that actually ship on the big platforms (Chrome's Google voices,
// Windows SAPI, macOS). It won't hit on every browser/OS combination; where
// it can't find a clearly-gendered match, pickVoice falls back to the old
// any-English-voice behavior rather than producing no voice at all.
const FEMALE_VOICE_HINTS = ['female', 'zira', 'samantha', 'hazel', 'karen', 'moira', 'susan', 'victoria', 'google us english'];
const MALE_VOICE_HINTS = ['male', 'david', 'mark', 'alex', 'daniel', 'james', 'fred'];

function pickVoice(voices, gender) {
  const english = voices.filter((v) => v.lang.startsWith('en-'));
  const hints = gender === 'man' ? MALE_VOICE_HINTS : FEMALE_VOICE_HINTS;
  const matched = english.find((v) => hints.some((h) => v.name.toLowerCase().includes(h)));
  if (matched) return matched;

  return (
    english.find((v) => v.name.toLowerCase().includes('google')) ||
    english[0] ||
    null
  );
}

/**
 * Text-to-speech boundary for the AI Interview Engine (beta). Phase 1 is
 * just the browser's built-in SpeechSynthesis — the same approach already
 * used in TavusAvatar.jsx's speakMock() for Mock Mode. Kept as one small
 * swappable function (not a class/interface) since there's no second
 * implementation yet; a future local Kokoro/Piper provider only needs to
 * match this same speak(text, opts) signature.
 */
export function speak(text, { onStart, onEnd, onBoundary, gender = 'woman' } = {}) {
  if (!('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  // A slight pitch nudge even when a clearly-gendered voice can't be found
  // on this browser/OS — cheap complement to voice selection, not a
  // replacement for it.
  utterance.pitch = gender === 'man' ? 0.92 : 1.08;

  const voice = pickVoice(window.speechSynthesis.getVoices(), gender);
  if (voice) utterance.voice = voice;

  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  // Word-boundary events are the mouth-animation clock for v1 — there is no
  // standard API to route SpeechSynthesis audio into an AnalyserNode for
  // real amplitude, so onboundary timing is the closest available signal
  // until a local TTS provider (Kokoro/Piper) returns a real audio buffer.
  utterance.onboundary = (event) => {
    if (event.name === 'word') onBoundary?.(event);
  };

  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
