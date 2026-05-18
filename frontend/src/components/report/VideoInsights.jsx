import { useRef } from 'react';

export default function VideoInsights({ videoUrl, moments = [] }) {
  const videoRef = useRef(null);

  const seekTo = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="col-span-full bg-[#0F172A] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
      <div className="p-8 border-b border-slate-800 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight uppercase">Interview Review</h2>
          <p className="text-xs text-slate-500 font-bold tracking-widest mt-1 uppercase">Visual playback with key insights</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Questions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Fillers</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3">
        {/* Video Side */}
        <div className="lg:col-span-2 p-4 bg-black aspect-video flex items-center justify-center">
          {videoUrl ? (
            <video 
              ref={videoRef}
              src={videoUrl} 
              controls 
              className="w-full h-full rounded-xl shadow-2xl"
            />
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mx-auto mb-4 border border-slate-800">
                <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Video processing or unavailable</p>
            </div>
          )}
        </div>

        {/* Moments Side */}
        <div className="lg:col-span-1 border-l border-slate-800 h-[400px] lg:h-auto overflow-y-auto bg-slate-900/30">
          <div className="p-4 bg-slate-900/50 border-b border-slate-800 text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">
            Key Moments ({moments.length})
          </div>
          <div className="divide-y divide-slate-800/50">
            {moments.length > 0 ? (
              moments.map((moment, idx) => (
                <button 
                  key={idx}
                  onClick={() => seekTo(moment.time)}
                  className="w-full p-5 text-left hover:bg-white/5 transition-all group flex gap-4 items-start"
                >
                  <div className={`mt-1 px-2 py-0.5 rounded text-[9px] font-black tracking-tighter text-white ${moment.type === 'question' ? 'bg-purple-600' : 'bg-red-600'}`}>
                    {formatTime(moment.time)}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-300 font-medium leading-relaxed group-hover:text-white transition-colors">
                      {moment.label}
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-10 text-center text-slate-600 italic text-xs">
                No moments detected yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
