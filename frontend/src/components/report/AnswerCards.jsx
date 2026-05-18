import React from 'react';

export default function AnswerCards({ answers }) {
  return (
    <div className="space-y-8">
      {answers?.map((answer, index) => {
        const score = answer.score || 0;
        const analysis = answer.analysis || answer.feedback || "Good effort. AI analysis not generated.";
        const ideal = answer.idealAnswer || answer.expectedAnswer || "To formulate an ideal response, structure your answer using the STAR method: explain the Situation, the Task at hand, the specific Action you took, and the measurable Result.";
        
        return (
          <div key={index} className="premium-card p-8 border border-slate-100/80 shadow-md hover:shadow-xl transition-all duration-300 rounded-3xl bg-white space-y-6">
            
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
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Question Score</span>
                  <span className="text-base font-black text-indigo-600">{score} / 10</span>
                </div>
                {answer.duration && (
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Duration</span>
                    <span className="text-sm font-bold text-slate-600">{answer.duration}s</span>
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
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Stitch asked</span>
                  <p className="text-sm font-bold text-slate-950 leading-relaxed">
                    {answer.question}
                  </p>
                </div>
              </div>

              {/* 2. Candidate's Spoken Transcript */}
              <div className="flex gap-4 items-start">
                <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center text-white flex-shrink-0 font-black text-xs">
                  🎙️
                </div>
                <div className="bg-purple-50/30 border border-purple-500/10 p-5 rounded-2xl flex-1">
                  <span className="text-[10px] font-black text-purple-500 uppercase tracking-wider block mb-1">Your Spoken Answer</span>
                  <p className="text-sm text-slate-800 font-medium italic leading-relaxed">
                    "{answer.transcript || 'No speech detected for this question.'}"
                  </p>
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
                  {answer.suggestion && (
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Key Recommendation</span>
                      <p className="text-xs font-bold text-slate-900 leading-relaxed">
                        {answer.suggestion}
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        );
      })}
    </div>
  );
}
