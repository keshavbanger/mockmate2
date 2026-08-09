import React from 'react';

const getBackendUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  return envUrl.replace(/\/api\/?$/, ''); // Strip trailing /api or /api/
};

// ─── Enhanced Audio Player with Filler-Seek Support ─────────────────────────
const AudioPlayer = React.forwardRef(({ src, fillerPositions, durationMs }, ref) => {
  const audioRef = React.useRef(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [duration, setDuration] = React.useState(0);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [loadError, setLoadError] = React.useState(false);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => setLoadError(true));
    }
  };

  const seekTo = (timeSeconds) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = timeSeconds;
    setCurrentTime(timeSeconds);
    if (!isPlaying) {
      audioRef.current.play().catch(() => {});
    }
  };

  // Expose seekTo to parent component
  React.useImperativeHandle(ref, () => ({
    seekTo
  }));

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
    setLoadError(false);
  };

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    if (!audioRef.current) return;
    const seekTime = parseFloat(e.target.value);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Calculate filler marker positions on the progress bar
  const fillerMarkers = React.useMemo(() => {
    if (!fillerPositions?.length || !durationMs) return [];
    const totalDuration = duration > 0 ? duration : durationMs / 1000;
    return fillerPositions
      .filter(f => f.estimatedTimeMs != null)
      .map((f, i) => ({
        id: i,
        word: f.word,
        timeSec: f.estimatedTimeMs / 1000,
        percent: Math.min(100, (f.estimatedTimeMs / (totalDuration * 1000)) * 100),
      }));
  }, [fillerPositions, durationMs, duration]);

  if (loadError) {
    return (
      <div className="flex items-center gap-3 bg-red-50/50 border border-red-100 rounded-2xl p-3 w-full max-w-md mt-4">
        <span className="text-red-400 text-xs font-bold">⚠️ Audio unavailable</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mt-4 space-y-2">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        crossOrigin="anonymous"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={() => setLoadError(true)}
      />

      <div className="flex items-center gap-3 bg-purple-500/5 border border-purple-500/10 rounded-2xl p-3 shadow-inner">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-md transition-all duration-200 flex-shrink-0 hover:scale-105 active:scale-95"
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Progress Bar with Filler Markers */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="relative h-2 group">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-2 bg-transparent appearance-none cursor-pointer z-10 opacity-0"
            />
            {/* Track background */}
            <div className="absolute inset-0 bg-purple-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-100"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {/* Filler markers on the track */}
            {fillerMarkers.map((marker) => (
              <button
                key={marker.id}
                onClick={() => seekTo(marker.timeSec)}
                title={`Filler: "${marker.word}" at ${formatTime(marker.timeSec)}`}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 hover:bg-red-600 hover:scale-150 transition-all z-20 cursor-pointer ring-2 ring-white"
                style={{ left: `${marker.percent}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-bold font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Filler markers legend */}
      {fillerMarkers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {fillerMarkers.map((marker) => (
            <button
              key={marker.id}
              onClick={() => seekTo(marker.timeSec)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
                         bg-red-50 text-red-600 border border-red-100 hover:bg-red-100
                         transition-colors cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
              "{marker.word}" @ {formatTime(marker.timeSec)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── Highlighted Transcript (fillers shown in red) ──────────────────────────
const HighlightedTranscript = ({ text, fillerPositions, onSeek }) => {
  if (!fillerPositions?.length || !text) {
    return (
      <p className="text-sm text-slate-800 font-medium italic leading-relaxed">
        "{text || 'No speech detected for this question.'}"
      </p>
    );
  }

  // Build segments: normal text + highlighted fillers
  const segments = [];
  let lastEnd = 0;

  // Sort fillers by charStart
  const sorted = [...fillerPositions].sort((a, b) => a.charStart - b.charStart);

  for (const filler of sorted) {
    // Add normal text before this filler
    if (filler.charStart > lastEnd) {
      segments.push({ type: 'text', content: text.substring(lastEnd, filler.charStart) });
    }
    // Add the filler word
    segments.push({
      type: 'filler',
      content: text.substring(filler.charStart, filler.charEnd),
      word: filler.word,
      timeMs: filler.estimatedTimeMs,
    });
    lastEnd = filler.charEnd;
  }
  // Remaining text after last filler
  if (lastEnd < text.length) {
    segments.push({ type: 'text', content: text.substring(lastEnd) });
  }

  const formatTime = (ms) => {
    if (!ms) return '0:00';
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <p className="text-sm text-slate-800 font-medium italic leading-relaxed">
      "
      {segments.map((seg, i) =>
        seg.type === 'filler' ? (
          <span
            key={i}
            onClick={() => onSeek?.(seg.timeMs)}
            title={`Filler word "${seg.word}" — click to jump to ${formatTime(seg.timeMs)}`}
            className="bg-red-100 text-red-700 font-bold px-1 py-0.5 rounded cursor-pointer
                       hover:bg-red-200 transition-colors relative group not-italic"
          >
            {seg.content}
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px]
                           px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity
                           whitespace-nowrap pointer-events-none font-mono">
              ⏱ {formatTime(seg.timeMs)}
            </span>
          </span>
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
      "
    </p>
  );
};

// ─── Individual Answer Card Item ─────────────────────────────────────────────
const AnswerCardItem = ({ answer, index }) => {
  const audioPlayerRef = React.useRef(null);
  const score = answer.score || 0;
  const analysis = answer.analysis || answer.feedback || "Good effort. AI analysis not generated.";

  let ideal;
  if (answer.idealAnswer && typeof answer.idealAnswer === 'string') {
    ideal = answer.idealAnswer;
  } else if (answer.idealAnswerPoints && Array.isArray(answer.idealAnswerPoints)) {
    ideal = answer.idealAnswerPoints
      .filter(p => p && p !== 'Point 1' && p !== 'Point 2')
      .join(' ');
  }
  if (!ideal || ideal.length < 20) {
    ideal = "Model answer not available for this question.";
  }

  const hasFillers = answer.fillerPositions?.length > 0;

  const handleSeek = (timeMs) => {
    if (audioPlayerRef.current && timeMs != null) {
      audioPlayerRef.current.seekTo(timeMs / 1000);
    }
  };

  return (
    <div className="premium-card p-8 border border-slate-100/80 shadow-md hover:shadow-xl transition-all duration-300 rounded-3xl bg-white space-y-6">
      {/* Header: Question Progress & Score */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-purple-100 text-purple-700 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider">
            Question {index + 1}
          </span>
          {answer.status && (
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              answer.status.includes('BEST') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
            }`}>
              {answer.status}
            </span>
          )}
          {hasFillers && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-500 border border-red-100">
              {answer.fillerCount} filler{answer.fillerCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Question Score</span>
            <span className="text-base font-black text-indigo-600">{score} / 10</span>
          </div>
          {answer.durationMs && (
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Duration</span>
              <span className="text-sm font-bold text-slate-600">{Math.round(answer.durationMs / 1000)}s</span>
            </div>
          )}
        </div>
      </div>

      {/* Q&A Timeline */}
      <div className="space-y-6">
        {/* 1. Interviewer's Question */}
        <div className="flex gap-4 items-start">
          <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-white flex-shrink-0 font-black text-xs">
            🤖
          </div>
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">MockMate asked</span>
            <p className="text-sm font-bold text-slate-950 leading-relaxed">
              {answer.question || answer.questionText}
            </p>
          </div>
        </div>

        {/* 2. Candidate's Spoken Transcript */}
        <div className="flex gap-4 items-start">
          <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center text-white flex-shrink-0 font-black text-xs">
            🎙️
          </div>
          <div className="bg-purple-50/30 border border-purple-500/10 p-5 rounded-2xl flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-purple-500 uppercase tracking-wider">Your Spoken Answer</span>
              {hasFillers && (
                <span className="text-[9px] font-bold text-red-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  Red = filler words (click to jump)
                </span>
              )}
            </div>
            <HighlightedTranscript
              text={answer.transcript}
              fillerPositions={answer.fillerPositions}
              onSeek={handleSeek}
            />
            {answer.audioUrl && (
              <AudioPlayer
                ref={audioPlayerRef}
                src={`${getBackendUrl()}${answer.audioUrl}`}
                fillerPositions={answer.fillerPositions}
                durationMs={answer.durationMs}
              />
            )}
          </div>
        </div>

        {/* 3. Expected / Ideal Model Answer */}
        <div className="flex gap-4 items-start">
          <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white flex-shrink-0 font-black text-xs">
            ✨
          </div>
          <div className="bg-emerald-50/20 border border-emerald-500/10 p-5 rounded-2xl flex-1">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block mb-1">Model Exemplary Answer</span>
            <p className="text-sm text-slate-800 font-medium leading-relaxed">
              {ideal}
            </p>
          </div>
        </div>

        {/* 4. AI Feedback & Evaluation */}
        <div className="flex gap-4 items-start pt-2 border-t border-slate-50">
          <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white flex-shrink-0 font-black text-xs">
            🧠
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider block mb-1">AI Performance Analysis</span>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {analysis}
              </p>
            </div>
            {/* Key Strengths */}
            {answer.keyStrengths?.length > 0 && (
              <div>
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider block mb-1">Key Strengths</span>
                <ul className="space-y-1">
                  {answer.keyStrengths.map((s, i) => (
                    <li key={i} className="text-xs text-slate-700 font-medium flex gap-2 items-start">
                      <span className="text-emerald-500 flex-shrink-0">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Areas to Improve */}
            {answer.improvements?.length > 0 && (
              <div>
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider block mb-1">Improvements</span>
                <ul className="space-y-1">
                  {answer.improvements.map((s, i) => (
                    <li key={i} className="text-xs text-slate-700 font-medium flex gap-2 items-start">
                      <span className="text-amber-500 flex-shrink-0">↑</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main AnswerCards Component ──────────────────────────────────────────────
export default function AnswerCards({ answers }) {
  return (
    <div className="space-y-8">
      {answers?.map((answer, index) => (
        <AnswerCardItem key={index} answer={answer} index={index} />
      ))}
    </div>
  );
}
