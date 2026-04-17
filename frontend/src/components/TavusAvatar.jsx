import { useState, useEffect, useRef } from 'react';
import { useInterview } from '../context/InterviewContext.jsx';
import { saveTurn } from '../utils/api.js';

// ─── Loading Overlay ──────────────────────────────────────────────────────────
function ConnectingOverlay({ visible }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center
                    bg-surface-800/95 backdrop-blur-sm rounded-xl z-10 gap-4">
      <div className="relative">
        <div className="h-14 w-14 rounded-full border-2 border-brand-500/30 flex items-center justify-center">
          <svg className="h-7 w-7 text-brand-400 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
        </div>
        <div className="absolute inset-0 rounded-full border-t-2 border-brand-400 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-white font-semibold">Connecting to InterviewBot…</p>
        <p className="text-slate-500 text-sm mt-1">Setting up your session</p>
      </div>
    </div>
  );
}

// ─── TavusAvatar ──────────────────────────────────────────────────────────────
export default function TavusAvatar({ conversationUrl }) {
  const ctx = useInterview();
  const [loaded, setLoaded] = useState(false);
  const [isMock, setIsMock] = useState(false);
  const [mockIndex, setMockIndex] = useState(0);
  const iframeRef = useRef(null);

  // 1. Detect if we are in mock mode
  useEffect(() => {
    if (conversationUrl?.includes('test-room')) {
      setIsMock(true);
      setLoaded(true);
    } else {
      setIsMock(false);
    }
  }, [conversationUrl]);

  // 2. Handle incoming messages from Tavus iframe
  useEffect(() => {
    const handleMessage = (event) => {
      const { type, data } = event.data || {};
      if (type === 'transcript' || (event.data?.event === 'conversation.transcript')) {
        const transcriptData = data || event.data.data;
        const text = transcriptData?.text;
        const role = transcriptData?.role; // 'assistant' or 'user'

        if (text) {
          ctx.updateTranscript(text);
          const mappedRole = role === 'assistant' ? 'interviewer' : 'candidate';
          saveTurn(ctx.sessionId, {
            role: mappedRole,
            text: text,
            timestamp_ms: Date.now()
          }).catch(err => console.error('Failed to save turn:', err));
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [ctx]);

  // 2b. Mock STT: Listen to microphone if in mock mode
  useEffect(() => {
    if (!isMock) return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      
      // Dispatch as a fake Tavus message so it goes through our standard pipeline
      window.postMessage({
        type: 'transcript',
        data: { text: text, role: 'user' }
      }, '*');
    };

    recognition.onerror = (event) => {
      console.warn('SpeechRecognition error:', event.error);
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn("Speech recognition failed to start:", e);
    }

    return () => recognition.stop();
  }, [isMock]);

  // 3. Mock Interview Logic: First question automatically, others via button
  const speakQuestion = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      // Optional: try to grab an English voice
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en-') && v.name.toLowerCase().includes('google')) 
                        || voices.find(v => v.lang.startsWith('en-'));
      if (englishVoice) utterance.voice = englishVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (!isMock || !ctx.questions.length || mockIndex !== 0) return;

    // Simulate the first question after 3 seconds
    const timer = setTimeout(() => {
      const questionText = ctx.questions[0];
      window.postMessage({
        type: 'transcript',
        data: { text: questionText, role: 'assistant' }
      }, '*');
      speakQuestion(questionText);
      setMockIndex(1);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isMock, mockIndex, ctx.questions]);

  const handleNextMockQuestion = () => {
    if (mockIndex < ctx.questions.length) {
      const questionText = ctx.questions[mockIndex];
      window.postMessage({
        type: 'transcript',
        data: { text: questionText, role: 'assistant' }
      }, '*');
      speakQuestion(questionText);
      setMockIndex(prev => prev + 1);
    }
  };

  // Safety: if no URL provided, show placeholder
  if (!conversationUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-700 rounded-xl">
        <p className="text-slate-500 text-sm">No conversation URL provided</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* iframe wrapper */}
      <div className="relative flex-1 bg-surface-800 rounded-xl overflow-hidden border border-white/5">
        <ConnectingOverlay visible={!loaded} />
        
        {isMock ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-surface-900 p-8 text-center">
            <div className="w-32 h-32 rounded-full bg-brand-500/10 flex items-center justify-center mb-6 border-2 border-brand-500/20 animate-pulse">
              <span className="text-5xl">🤖</span>
            </div>
            <h3 className="text-white text-xl font-bold mb-2">Mock Interview Mode</h3>
            <p className="text-slate-400 text-sm max-w-sm mb-6">
              You are using test API keys. The first question was sent automatically.
            </p>
            
            {mockIndex > 0 && mockIndex < ctx.questions.length ? (
               <button 
                 onClick={handleNextMockQuestion}
                 className="btn-primary py-2 px-6 shadow-brand/20 shadow-lg hover:shadow-brand/40 transition-all font-semibold"
               >
                 Ask Next Question ({mockIndex}/{ctx.questions.length})
               </button>
            ) : mockIndex >= ctx.questions.length ? (
               <div className="text-brand-400 text-sm font-semibold max-w-sm">
                 All questions asked. You can end the interview when you finish answering!
               </div>
            ) : (
                <div className="flex items-center gap-2 text-brand-400 text-xs font-mono bg-brand-500/5 px-4 py-2 rounded-full border border-brand-500/10">
                  <span className="h-2 w-2 rounded-full bg-brand-400 animate-ping" />
                  SYSTEM: PREPARING FIRST QUESTION...
                </div>
            )}
            
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={conversationUrl}
            allow="camera; microphone; autoplay; display-capture; fullscreen"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            className="w-full h-full border-0"
            style={{ minHeight: '440px' }}
            title="InterviewBot AI Interviewer"
          />
        )}
      </div>

      {/* Interviewer label bar */}
      <div className="flex items-center justify-between px-4 py-2.5
                      bg-surface-700 rounded-xl border border-white/5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-brand-500/20 flex items-center justify-center
                          text-brand-400 font-bold text-sm">
            IB
          </div>
          <div>
            <p className="text-white text-sm font-semibold">InterviewBot</p>
            <p className="text-slate-500 text-xs">{isMock ? 'AI Simulator (Mock)' : 'AI Interview Coach'}</p>
          </div>
        </div>

        {loaded ? (
          <div className="flex items-center gap-1.5 badge-green">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 live-dot" />
            Live
          </div>
        ) : (
          <div className="flex items-center gap-1.5 badge bg-slate-500/15 text-slate-400
                          border border-slate-500/20 text-xs">
            Connecting…
          </div>
        )}
      </div>
    </div>
  );
}
