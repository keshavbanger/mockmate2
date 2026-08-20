/**
 * Text-to-speech boundary for the AI Interview Engine (beta). Phase 1 is
 * just the browser's built-in SpeechSynthesis — the same approach already
 * used in TavusAvatar.jsx's speakMock() for Mock Mode. Kept as one small
 * swappable function (not a class/interface) since there's no second
 * implementation yet; a future local Kokoro/Piper provider only needs to
 * match this same speak(text, opts) signature.
 */
export function speak(text, { onStart, onEnd, onBoundary } = {}) {
  if (!('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((v) => v.lang.startsWith('en-') && v.name.toLowerCase().includes('google')) ||
    voices.find((v) => v.lang.startsWith('en-')) ||
    null;
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
