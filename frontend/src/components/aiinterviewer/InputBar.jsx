import AudioVisualizer from './AudioVisualizer.jsx';

export default function InputBar({
  avatarState,
  micStream,
  onStartRecording,
  onStopRecording,
  textAnswer,
  onTextAnswerChange,
  onTextSubmit,
  hint,
}) {
  const isListening = avatarState === 'listening';
  const busy = avatarState === 'thinking' || avatarState === 'speaking';

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
      {/* RecordingState */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {isListening ? (
          <>
            <button
              onClick={onStopRecording}
              className="w-full sm:w-auto flex-shrink-0 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              ⏹️ Stop Recording
            </button>
            <AudioVisualizer mode="mic" stream={micStream} />
          </>
        ) : (
          <button
            onClick={onStartRecording}
            disabled={busy}
            className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            🎙️ Start Recording
          </button>
        )}
        {hint && <span className="text-[11px] text-slate-400 font-semibold text-center sm:text-left">{hint}</span>}
      </div>

      <div className="h-px bg-slate-100" />

      {/* TextFallback */}
      <form onSubmit={onTextSubmit} className="flex gap-2">
        <input
          type="text"
          value={textAnswer}
          onChange={(e) => onTextAnswerChange(e.target.value)}
          placeholder="Type your answer instead"
          disabled={busy}
          className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#6B46C1] outline-none disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={busy || !textAnswer.trim()}
          className="text-xs font-bold text-white bg-slate-900 hover:bg-black px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
