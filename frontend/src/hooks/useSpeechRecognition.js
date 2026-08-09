import { useState, useRef, useCallback } from 'react';

/**
 * useSpeechRecognition — robust hook that properly separates
 * interim (replace) vs final (append) transcript segments.
 *
 * Key guarantees:
 * - interimText is ALWAYS replaced, never appended → fixes duplication bug
 * - finalText   is ONLY appended when isFinal=true   → fixes "no speech" bug
 * - resetForNextQuestion() returns captured answer and clears for next Q
 */
export function useSpeechRecognition(lang = 'en-US') {
  const [finalText, setFinalText]   = useState('');
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef      = useRef(null);
  const isInterviewActiveRef = useRef(false);
  // Keep a ref mirror of finalText so event handlers always see latest value
  const finalTextRef = useRef('');
  const langRef = useRef(lang);

  // Keep langRef updated when lang changes
  if (langRef.current !== lang) {
    langRef.current = lang;
  }

  const stopListening = useCallback(() => {
    isInterviewActiveRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('SpeechRecognition not supported in this browser.');
      return;
    }

    // Avoid duplicate instances
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) { /* ignore */ }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous      = true;
    recognition.interimResults  = true;
    recognition.lang            = langRef.current;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let newFinal  = '';
      let newInterim = '';

      // Only process from the latest resultIndex to avoid re-processing old results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += transcript + ' ';
        } else {
          newInterim += transcript;
        }
      }

      // APPEND only confirmed final text
      if (newFinal) {
        finalTextRef.current = finalTextRef.current + newFinal;
        setFinalText(finalTextRef.current);
      }

      // REPLACE interim text (never append — this is the duplication fix)
      setInterimText(newInterim);
    };

    recognition.onerror = (e) => {
      // 'aborted' fires whenever stop() is called while recognition is running — completely harmless.
      // We silently ignore it to avoid console spam (it fires 30-50+ times per interview session).
      if (e.error === 'aborted') return;

      if (e.error === 'no-speech') {
        // Non-fatal — recognition will auto-restart via onend
      } else if (e.error === 'network') {
        setError('Microphone network error. Check your connection.');
      } else if (e.error === 'not-allowed') {
        setError('Microphone permission denied.');
        isInterviewActiveRef.current = false;
      } else {
        console.warn('[Speech] Error:', e.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart as long as the interview is still active.
      // Use 250ms debounce (instead of 100ms) to prevent rapid-fire restart loops.
      if (isInterviewActiveRef.current) {
        setTimeout(() => {
          if (isInterviewActiveRef.current) {
            try {
              recognition.start();
            } catch (err) {
              // Ignore InvalidStateError — recognition may already be starting
              if (!err.message?.includes('already started')) {
                console.warn('[Speech] Restart failed:', err);
              }
            }
          }
        }, 250);
      } else {
        setIsListening(false);
      }
    };

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    try {
      isInterviewActiveRef.current = true;
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error('[Speech] Failed to start:', e);
      setError('Failed to start microphone.');
    }
  }, []);

  /**
   * Call this when moving to the NEXT question.
   * Returns the captured spoken answer text, then clears both buffers.
   */
  const resetForNextQuestion = useCallback(() => {
    const captured = finalTextRef.current.trim();
    finalTextRef.current = '';
    setFinalText('');
    setInterimText('');
    return captured;
  }, []);

  /**
   * Call this to get a snapshot of the current answer without resetting.
   */
  const getCurrentAnswer = useCallback(() => {
    return finalTextRef.current.trim();
  }, []);

  return {
    finalText,
    interimText,
    isListening,
    error,
    startListening,
    stopListening,
    resetForNextQuestion,
    getCurrentAnswer,
  };
}
