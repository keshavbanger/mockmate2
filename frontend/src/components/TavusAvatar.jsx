import { useState, useEffect, useRef } from 'react';
import { useInterview } from '../context/InterviewContext.jsx';
import { saveTurn, sendMockChat } from '../utils/api.js';

// ─── Loading Overlay ──────────────────────────────────────────────────────────
function ConnectingOverlay({ visible }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center
                    bg-white/95 backdrop-blur-sm rounded-[32px] z-10 gap-6">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-2 border-purple-500/10 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-purple-500 animate-ping" />
        </div>
        <div className="absolute inset-0 rounded-full border-t-2 border-purple-500 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-black font-bold tracking-tight">Connecting to Stitch AI</p>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Initializing Persona</p>
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
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [turnId, setTurnId] = useState(0); // Forces STT restart per question
  
  const iframeRef = useRef(null);
  const currentAnswerRef = useRef('');
  const silenceTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastProcessedIndexRef = useRef(-1);

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
          if (isMock) return; // mock mode handles its own saving to prevent duplicates
          
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
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true; // Instant feedback
    recognition.lang = 'en-US';

    lastProcessedIndexRef.current = -1;

    recognition.onresult = (event) => {
      if (isMuted) return;

      let fullTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        fullTranscript += event.results[i][0].transcript;
        
        // Dispatch only new final results to context transcript
        if (event.results[i].isFinal && i > lastProcessedIndexRef.current) {
          window.postMessage({
            type: 'transcript',
            data: { text: event.results[i][0].transcript, role: 'user' }
          }, '*');
          lastProcessedIndexRef.current = i;
        }
      }
      
      setCurrentAnswer(fullTranscript);
      currentAnswerRef.current = fullTranscript;

      // Auto-submit after 4 seconds of silence
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (currentAnswerRef.current.trim().length > 0) {
          autoSubmitAnswer(currentAnswerRef.current);
        }
      }, 4000);
    };

    recognition.onerror = (event) => {
      console.warn('SpeechRecognition error:', event.error);
    };

    recognition.onend = () => {
      // Auto restart if it died unexpectedly and we aren't muted
      if (!isMuted && isMock) {
        try { recognition.start(); } catch (e) {}
      }
    };

    try {
      if (!isMuted) {
        recognition.start();
      }
    } catch (e) {
      console.warn("Speech recognition failed to start:", e);
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recognition.onend = null; // Prevent restart loop on unmount
      try { recognition.stop(); } catch (e) {}
    };
  }, [isMock, isMuted, turnId]);

  // 3. Structured Interview Logic: Speak question when index changes
  const speakQuestion = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en-') && v.name.toLowerCase().includes('google')) 
                        || voices.find(v => v.lang.startsWith('en-'));
      if (englishVoice) utterance.voice = englishVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  const { currentQuestionIndex } = ctx.sessionMetrics;
  const { questions } = ctx;

  useEffect(() => {
    if (!isMock || !questions.length) return;
    
    // If we just started, give a greeting + first question
    if (currentQuestionIndex === 0 && mockIndex === 0) {
      const candidateName = ctx.resumeData?.name || "there";
      const text = `Hello ${candidateName}, welcome to the interview! I'll ask you ${questions.length} questions. Let's start with the first one. ${questions[0]}`;
      
      speakQuestion(text);
      saveTurn(ctx.sessionId, { role: 'interviewer', text: text, timestamp_ms: Date.now() });
      setMockIndex(1);
    } 
    // If question index changed, speak the next question
    else if (currentQuestionIndex < questions.length && currentQuestionIndex + 1 > mockIndex) {
      const text = questions[currentQuestionIndex];
      speakQuestion(text);
      saveTurn(ctx.sessionId, { role: 'interviewer', text: text, timestamp_ms: Date.now() });
      setMockIndex(currentQuestionIndex + 1);
    }
    // If all done
    else if (currentQuestionIndex >= questions.length && mockIndex === questions.length) {
      const text = "That concludes our interview. Thank you! Please click End Interview to see your report.";
      speakQuestion(text);
      saveTurn(ctx.sessionId, { role: 'interviewer', text: text, timestamp_ms: Date.now() });
      setMockIndex(mockIndex + 1);
    }
  }, [isMock, currentQuestionIndex, questions, ctx.sessionId, ctx.resumeData?.name, mockIndex]);

  // Safety: if no URL provided, show placeholder
  if (!conversationUrl) {
    return (
    <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-[32px] border border-black/[0.03]">
      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Waiting for Session...</p>
    </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* iframe wrapper */}
      <div className="relative flex-1 bg-white rounded-[32px] overflow-hidden border border-black/[0.03] shadow-lg">
        <ConnectingOverlay visible={!loaded} />
        
        {isMock ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#f8f9fa] p-10 text-center">
            <div className="relative mb-10">
              <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center border border-black/[0.03] shadow-2xl">
                <span className="text-6xl">🤖</span>
              </div>
              {/* Outer pulse */}
              <div className="absolute -inset-4 rounded-full border border-purple-500/10 animate-ping opacity-40" />
            </div>

            <h3 className="text-black text-2xl font-black mb-2 tracking-tighter">stitch <span className="text-purple-500">interviewer</span></h3>
            
            <div className="bg-white border border-black/[0.03] rounded-3xl p-8 max-w-sm w-full shadow-sm">
              <p className="text-slate-600 text-sm font-medium leading-relaxed italic">
                "{currentQuestionIndex < questions.length ? questions[currentQuestionIndex] : "Session concluded."}"
              </p>
            </div>

            <div className="mt-12 flex flex-col items-center gap-3">
              <div className="flex gap-1.5">
                {questions.map((_, i) => (
                  <div key={i} className="h-1.5 w-6 rounded-full bg-slate-200 overflow-hidden">
                    <div 
                      className={`h-full bg-black transition-all duration-700 ${i <= currentQuestionIndex ? 'w-full' : 'w-0'}`}
                    />
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Progress</span>
            </div>
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
      <div className="flex items-center justify-between px-6 py-4
                      bg-white rounded-[24px] border border-black/[0.03] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center border border-black/[0.03]
                          text-black font-black text-xs shadow-sm">
            ST
          </div>
          <div>
            <p className="text-black text-sm font-bold tracking-tight">stitch ai</p>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{isMock ? 'Mock Persona' : 'Live Persona'}</p>
          </div>
        </div>

        {loaded ? (
          <div className="flex items-center gap-2 bg-purple-50 px-4 py-1.5 rounded-full border border-purple-500/10">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-purple-600 text-[10px] font-black uppercase tracking-widest">Connected</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-1.5 rounded-full border border-black/[0.03]">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Idle</span>
          </div>
        )}
      </div>
    </div>
  );
}
