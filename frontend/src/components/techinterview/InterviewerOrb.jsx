import React from 'react';

/**
 * InterviewerOrb Component
 * State-driven visual AI interviewer avatar orb.
 * States: 'idle' | 'speaking' | 'loading' / 'thinking'
 */
export default function InterviewerOrb({ state = 'idle', interviewerName = 'MockMate AI' }) {
  const isSpeaking = state === 'speaking';
  const isLoading = state === 'loading' || state === 'thinking';

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes orbBreathing {
          0%, 100% { transform: scale(1); box-shadow: 0 0 25px rgba(99, 102, 241, 0.4); }
          50% { transform: scale(1.05); box-shadow: 0 0 45px rgba(139, 92, 246, 0.6); }
        }
        @keyframes orbSpeaking {
          0% { transform: scale(1.02); box-shadow: 0 0 35px rgba(6, 182, 212, 0.6); }
          25% { transform: scale(1.1); box-shadow: 0 0 60px rgba(99, 102, 241, 0.8); }
          50% { transform: scale(0.98); box-shadow: 0 0 30px rgba(139, 92, 246, 0.5); }
          75% { transform: scale(1.08); box-shadow: 0 0 55px rgba(6, 182, 212, 0.8); }
          100% { transform: scale(1.02); box-shadow: 0 0 35px rgba(6, 182, 212, 0.6); }
        }
        @keyframes orbSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes wavePulse {
          0%, 100% { height: 6px; }
          50% { height: 22px; }
        }
      `}</style>

      <div style={styles.orbWrapper}>
        {/* Outer ambient aura */}
        <div style={{
          ...styles.aura,
          animation: isLoading
            ? 'orbSpin 3s linear infinite'
            : isSpeaking
            ? 'orbSpeaking 1.2s ease-in-out infinite'
            : 'orbBreathing 4s ease-in-out infinite'
        }} />

        {/* Core Orb */}
        <div style={{
          ...styles.core,
          background: isLoading
            ? 'radial-gradient(circle at 35% 35%, #06b6d4, #6B46C1, #4c1d95)'
            : isSpeaking
            ? 'radial-gradient(circle at 35% 35%, #38bdf8, #9F7AEA, #4c1d95)'
            : 'radial-gradient(circle at 35% 35%, #9F7AEA, #6B46C1, #4c1d95)'
        }}>
          {isLoading && (
            <div style={styles.spinnerRing} />
          )}

          {isSpeaking && (
            <div style={styles.waveContainer}>
              <div style={{ ...styles.waveBar, animationDelay: '0ms' }} />
              <div style={{ ...styles.waveBar, animationDelay: '150ms' }} />
              <div style={{ ...styles.waveBar, animationDelay: '300ms' }} />
              <div style={{ ...styles.waveBar, animationDelay: '450ms' }} />
            </div>
          )}

          {!isLoading && !isSpeaking && (
            <div style={styles.sparkle} />
          )}
        </div>
      </div>

      <div style={styles.metaContainer}>
        <div style={styles.nameTag}>{interviewerName}</div>
        <div style={styles.statusTag}>
          <span style={{
            ...styles.statusDot,
            backgroundColor: isLoading ? '#f59e0b' : isSpeaking ? '#10b981' : '#6B46C1'
          }} />
          {isLoading ? 'Thinking...' : isSpeaking ? 'Speaking...' : 'Listening'}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 18px',
    background: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  orbWrapper: {
    position: 'relative',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aura: {
    position: 'absolute',
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    filter: 'blur(6px)',
  },
  core: {
    position: 'relative',
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  spinnerRing: {
    width: '28px',
    height: '28px',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'orbSpin 0.8s linear infinite',
  },
  waveContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    height: '24px',
  },
  waveBar: {
    width: '3px',
    backgroundColor: '#ffffff',
    borderRadius: '3px',
    animation: 'wavePulse 0.8s ease-in-out infinite',
  },
  sparkle: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    boxShadow: '0 0 10px #ffffff',
  },
  metaContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  nameTag: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#111827',
    letterSpacing: '-0.01em',
  },
  statusTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '2px',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
};
