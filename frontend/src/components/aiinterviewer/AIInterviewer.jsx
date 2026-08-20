import AvatarStage from './AvatarStage.jsx';
import InputBar from './InputBar.jsx';

function formatElapsed(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// Top-level composition — see the design brief's component tree. Purely
// presentational: all state-machine logic (transitions, timing, the
// REPEAT_REQUEST skip-THINKING rule) lives in AIInterviewBetaPage, which
// owns the actual interview orchestration. This component just renders
// whatever avatarState it's handed.
//
// Single centered column, deliberately compact — the recording controls
// and End Interview are the thing a candidate needs mid-answer, so they
// have to stay visible without scrolling. A separate named-stage progress
// sidebar used to live here; it pushed those controls below the fold on a
// normal viewport, so it's gone. The header shows a running "questions
// asked" count with no denominator — the adaptive engine has no fixed
// question total, so a "X / N" framing would be actively misleading.
export default function AIInterviewer({
  avatarState, message, turnType, statusDetail,
  micStream, mouthPulse, avatarSet,
  roleTitle, interviewType, difficulty, elapsedSeconds,
  questionsAsked, isLastQuestion,
  onStartRecording, onStopRecording,
  textAnswer, onTextAnswerChange, onTextSubmit,
  inputHint,
}) {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      {/* Header — role title, track/difficulty, elapsed time + question count */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-600 bg-purple-50 px-3 py-1 rounded-full mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            AI Interview Engine · Beta
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {roleTitle || 'AI Mock Interview'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {interviewType} Interview <span className="text-slate-300 mx-1">·</span> {difficulty}
          </p>
        </div>

        <div className="flex gap-2.5 flex-shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm text-center min-w-[76px]">
            <p className="text-sm font-black text-slate-900 tabular-nums">{formatElapsed(elapsedSeconds)}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wide">Elapsed</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm text-center min-w-[76px]">
            <p className="text-sm font-black text-slate-900 tabular-nums">{questionsAsked}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wide">Asked</p>
          </div>
        </div>
      </div>

      <AvatarStage
        avatarState={avatarState}
        message={message}
        turnType={turnType}
        statusDetail={statusDetail}
        micStream={micStream}
        mouthPulse={mouthPulse}
        avatarSet={avatarSet}
      />

      {!isLastQuestion && (
        <InputBar
          avatarState={avatarState}
          micStream={micStream}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
          textAnswer={textAnswer}
          onTextAnswerChange={onTextAnswerChange}
          onTextSubmit={onTextSubmit}
          hint={inputHint}
        />
      )}
    </div>
  );
}
