import React, { useEffect, useRef, useState } from 'react';

/**
 * ConversationPanel Component
 * Redesigned conversation panel with:
 * - Active Round & Question Header Banner
 * - Dual Input Mode (Type vs. Speak) using Web Speech API
 * - Editable Speech-to-Text area (Speech populates text box, NO auto-submit)
 * - Sleek dark glassmorphism styling
 */
export default function ConversationPanel({
  messages = [],
  currentInput = '',
  onInputChange,
  onSend,
  loading = false,
  activeRoundName = 'Technical Interview',
  activeTopic = '',
  complexity,
  onComplexityChange,
  showComplexity = false,
  editorMode = null,
  onReplayAudio,
  onRetry
}) {
  const bottomRef = useRef(null);

  // Input Mode state: 'type' | 'speak'
  const [inputMode, setInputMode] = useState('type');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [codeNotice, setCodeNotice] = useState(null);
  
  // Bug 10: Dual buffer for Speech-to-Text deduplication
  const committedTextRef = useRef('');
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Setup Web Speech API with dual buffer (Bug 10)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event) => {
      let currentCommitted = committedTextRef.current;
      let newInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptChunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          currentCommitted += (currentCommitted ? ' ' : '') + transcriptChunk.trim();
          committedTextRef.current = currentCommitted;
        } else {
          newInterim += (newInterim ? ' ' : '') + transcriptChunk;
        }
      }

      setInterimText(newInterim);
      const combined = (committedTextRef.current + (newInterim ? ' ' + newInterim : '')).trim();
      onInputChange(combined);
    };

    rec.onerror = (err) => {
      console.warn('[STT] Speech recognition error:', err);
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
      // Finalize with committed text only
      onInputChange(committedTextRef.current.trim());
      setInterimText('');
    };

    recognitionRef.current = rec;
  }, [onInputChange]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        committedTextRef.current = currentInput.trim();
        setInterimText('');
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('[STT] Failed to start speech recognition:', err);
      }
    }
  };

  // Bug 7: Code paste detection helper
  const isCodeLikeInput = (text) => {
    if (!text) return false;
    const codePatterns = [
      /class\s+\w+/i,
      /def\s+\w+/i,
      /function\s+\w+/i,
      /return\s+/i,
      /import\s+/i,
      /var\s+\w+\s*=/i,
      /let\s+\w+\s*=/i,
      /const\s+\w+\s*=/i,
      /for\s*\(.*\;.*\;.*\)/i,
      /while\s*\(.*\)/i,
      /\{\s*[\s\S]*\}/
    ];
    const isMultiLine = text.trim().includes('\n');
    return isMultiLine && codePatterns.some(pattern => pattern.test(text));
  };

  const handleSendAttempt = () => {
    if (!currentInput.trim() || loading) return;

    // Intercept code typed into chat box during coding round
    if ((editorMode === 'CODE' || editorMode === 'SQL') && isCodeLikeInput(currentInput)) {
      setCodeNotice("It looks like you're writing code — please use the code editor panel on the right so I can run your solution and test cases!");
      return;
    }

    setCodeNotice(null);
    onSend();
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendAttempt();
    }
  };

  // Bug 9: Manual TTS trigger handler
  const handlePlayTTS = (text) => {
    if (onReplayAudio) {
      onReplayAudio(text);
      return;
    }
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onerror = (e) => console.warn('[TTS] SpeechSynthesis error:', e);
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.warn('[TTS] Audio playback failed:', e);
    }
  };

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
          50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
        }
      `}</style>

      {/* Header Banner */}
      <div style={styles.banner}>
        <div style={styles.bannerBadge}>{activeRoundName}</div>
        {activeTopic && <div style={styles.bannerTopic}>Focus: {activeTopic}</div>}
      </div>

      {/* Code Editor Guidance Banner (Bug 7) */}
      {(editorMode === 'CODE' || editorMode === 'SQL') && (
        <div style={styles.editorGuidanceBanner}>
          💡 <strong>Editor Active:</strong> Submit your solution via the code editor on the right.
        </div>
      )}

      {/* Message History */}
      <div style={styles.msgList}>
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const isSystemErr = msg.isSystemError || (msg.text && msg.text.startsWith('⚠️'));

          // Bug 7: System Error distinct rendering
          if (isSystemErr) {
            const isLastMessage = i === messages.length - 1;
            return (
              <div key={i} style={styles.systemErrorRow}>
                <div style={styles.systemErrorBanner}>
                  <div style={styles.systemErrorTitle}>⚠️ System Warning</div>
                  <div style={styles.systemErrorText}>{msg.text}</div>
                  <div style={styles.systemErrorFooter}>
                    <span style={{ fontSize: '0.72rem', color: '#f87171' }}>
                      Server connection interrupted — please re-submit your response.
                    </span>
                    {onRetry && isLastMessage && (
                      <button
                        style={styles.retryBtn}
                        onClick={() => onRetry()}
                        disabled={loading}
                      >
                        🔁 Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={i}
              style={{
                ...styles.msgRow,
                justifyContent: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              {!isUser && (
                <div style={styles.aiAvatar}>AI</div>
              )}
              <div
                style={{
                  ...styles.bubble,
                  ...(isUser ? styles.userBubble : styles.aiBubble),
                }}
              >
                <div style={styles.bubbleText}>{msg.text}</div>
                <div style={styles.bubbleFooter}>
                  {!isUser && (
                    <button
                      style={styles.replayBtn}
                      onClick={() => handlePlayTTS(msg.text)}
                      title="Replay Audio"
                    >
                      🔊 Listen
                    </button>
                  )}
                  <div style={styles.timestamp}>
                    {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
              {isUser && (
                <div style={styles.userAvatar}>You</div>
              )}
            </div>
          );
        })}

        {loading && (
          <div style={{ ...styles.msgRow, justifyContent: 'flex-start' }}>
            <div style={styles.aiAvatar}>AI</div>
            <div style={{ ...styles.bubble, ...styles.aiBubble }}>
              <div style={styles.typing}>
                <span style={styles.typingDot} />
                <span style={styles.typingDot} />
                <span style={styles.typingDot} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Code Notice Toast (Bug 7) */}
      {codeNotice && (
        <div style={styles.codeNoticeBox}>
          <div style={{ flex: 1 }}>{codeNotice}</div>
          <button style={styles.codeNoticeDismiss} onClick={() => setCodeNotice(null)}>✕</button>
        </div>
      )}

      {/* Complexity Input (DSA solved mode) */}
      {showComplexity && complexity && (
        <div style={styles.complexityBox}>
          <div style={styles.complexityTitle}>⚡ Complexity Analysis</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={styles.complexityLabel}>Time Complexity</label>
              <input
                style={styles.complexityInput}
                placeholder="e.g. O(N log N)"
                value={complexity.time}
                onChange={(e) =>
                  onComplexityChange({ ...complexity, time: e.target.value })
                }
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.complexityLabel}>Space Complexity</label>
              <input
                style={styles.complexityInput}
                placeholder="e.g. O(1)"
                value={complexity.space}
                onChange={(e) =>
                  onComplexityChange({ ...complexity, space: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Input Mode Selector Bar */}
      <div style={styles.modeBar}>
        <div style={styles.modeToggleGroup}>
          <button
            style={{
              ...styles.modeBtn,
              ...(inputMode === 'type' ? styles.modeBtnActive : {}),
            }}
            onClick={() => setInputMode('type')}
          >
            ⌨️ Type Answer
          </button>
          <button
            style={{
              ...styles.modeBtn,
              ...(inputMode === 'speak' ? styles.modeBtnActive : {}),
              opacity: speechSupported ? 1 : 0.5,
            }}
            onClick={() => {
              if (speechSupported) setInputMode('speak');
            }}
            title={speechSupported ? 'Speak answer' : 'Speech recognition unavailable'}
          >
            🎙️ Speak Answer
          </button>
        </div>

        {inputMode === 'speak' && speechSupported && (
          <button
            style={{
              ...styles.micBtn,
              backgroundColor: isListening ? '#ef4444' : '#6B46C1',
              animation: isListening ? 'micPulse 1.5s infinite' : 'none',
            }}
            onClick={toggleListening}
          >
            {isListening ? '🛑 Stop Recording' : '🔴 Hold/Tap to Speak'}
          </button>
        )}
      </div>

      {/* Main Text Input Area */}
      <div style={styles.inputArea}>
        <textarea
          style={styles.textarea}
          placeholder={
            inputMode === 'speak'
              ? (isListening ? 'Listening... Speak clearly into your mic.' : 'Spoken words will appear here. Edit before sending...')
              : 'Type your answer here... (Press Enter to submit, Shift+Enter for newline)'
          }
          value={currentInput}
          onChange={(e) => {
            setCodeNotice(null);
            onInputChange(e.target.value);
          }}
          onKeyDown={handleKey}
          rows={3}
          disabled={loading}
        />
        <button
          style={{
            ...styles.sendBtn,
            opacity: loading || !currentInput.trim() ? 0.5 : 1,
            cursor: loading || !currentInput.trim() ? 'not-allowed' : 'pointer',
          }}
          onClick={handleSendAttempt}
          disabled={loading || !currentInput.trim()}
        >
          {loading ? '...' : '➤'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#ffffff',
    borderRight: '1px solid rgba(0, 0, 0, 0.06)',
  },
  banner: {
    padding: '12px 18px',
    background: '#fafafa',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerBadge: {
    background: '#6B46C1',
    color: '#ffffff',
    fontSize: '0.75rem',
    fontWeight: '700',
    padding: '4px 10px',
    borderRadius: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  bannerTopic: {
    fontSize: '0.8rem',
    color: '#6b7280',
    fontWeight: '500',
  },
  msgList: {
    flex: 1,
    overflowY: 'auto',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: '10px' },
  aiAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#6B46C1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '700',
    flexShrink: 0,
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
    fontSize: '11px',
    fontWeight: '600',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: '16px',
    padding: '12px 16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  aiBubble: {
    background: '#fafafa',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    borderBottomLeftRadius: '4px',
  },
  userBubble: {
    background: '#F3E8FF',
    border: '1px solid rgba(107, 70, 193, 0.15)',
    borderBottomRightRadius: '4px',
  },
  bubbleText: {
    color: '#111827',
    fontSize: '0.88rem',
    lineHeight: '1.55',
    whiteSpace: 'pre-wrap',
  },
  timestamp: {
    color: '#9ca3af',
    fontSize: '0.7rem',
    marginTop: '6px',
    textAlign: 'right',
  },
  typing: { display: 'flex', gap: '6px', padding: '6px 4px' },
  typingDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#9F7AEA',
  },
  complexityBox: {
    background: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '12px',
    padding: '12px 16px',
    margin: '0 18px 12px',
  },
  complexityTitle: {
    color: '#059669',
    fontSize: '0.8rem',
    fontWeight: '700',
    marginBottom: '8px',
  },
  complexityLabel: {
    display: 'block',
    color: '#6b7280',
    fontSize: '0.72rem',
    marginBottom: '4px',
  },
  complexityInput: {
    width: '100%',
    background: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '8px',
    color: '#111827',
    padding: '6px 10px',
    fontSize: '0.8rem',
    outline: 'none',
  },
  modeBar: {
    padding: '8px 18px',
    background: '#fafafa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    borderTop: '1px solid rgba(0, 0, 0, 0.05)',
  },
  modeToggleGroup: {
    display: 'flex',
    gap: '6px',
    background: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    padding: '3px',
    borderRadius: '10px',
  },
  modeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6b7280',
    padding: '5px 10px',
    fontSize: '0.75rem',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  modeBtnActive: {
    background: '#6B46C1',
    color: '#ffffff',
  },
  micBtn: {
    border: 'none',
    color: '#ffffff',
    padding: '6px 12px',
    fontSize: '0.75rem',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  inputArea: {
    display: 'flex',
    gap: '10px',
    padding: '14px 18px',
    background: '#ffffff',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
  },
  textarea: {
    flex: 1,
    background: '#fafafa',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '12px',
    color: '#111827',
    padding: '10px 14px',
    fontSize: '0.88rem',
    resize: 'none',
    lineHeight: '1.5',
    outline: 'none',
  },
  sendBtn: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: '#6B46C1',
    border: 'none',
    color: '#ffffff',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorGuidanceBanner: {
    background: '#F3E8FF',
    borderBottom: '1px solid rgba(107, 70, 193, 0.15)',
    color: '#6B46C1',
    padding: '8px 18px',
    fontSize: '0.78rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  systemErrorRow: {
    display: 'flex',
    justifyContent: 'center',
    margin: '10px 0',
  },
  systemErrorBanner: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '12px',
    padding: '12px 16px',
    width: '90%',
  },
  systemErrorTitle: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: '0.85rem',
    marginBottom: '4px',
  },
  systemErrorText: {
    color: '#991b1b',
    fontSize: '0.82rem',
    lineHeight: '1.45',
  },
  systemErrorFooter: {
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  retryBtn: {
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    color: '#b91c1c',
    fontSize: '0.72rem',
    fontWeight: '700',
    padding: '5px 12px',
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  bubbleFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '6px',
    gap: '8px',
  },
  replayBtn: {
    background: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '6px',
    color: '#059669',
    fontSize: '0.7rem',
    padding: '2px 8px',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  codeNoticeBox: {
    margin: '0 18px 8px',
    padding: '10px 14px',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '10px',
    color: '#b45309',
    fontSize: '0.78rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    lineHeight: '1.4',
  },
  codeNoticeDismiss: {
    background: 'transparent',
    border: 'none',
    color: '#b45309',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '0 4px',
  },
};
