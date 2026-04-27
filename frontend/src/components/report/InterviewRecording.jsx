import { motion } from 'framer-motion';

export default function InterviewRecording({ videoUrl, thumbnail }) {
  // Use a placeholder if no video is provided yet
  const source = videoUrl || "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

  return (
    <div className="col-12 premium-card overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h3 className="section-header">Interview Recording</h3>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Session Replay
          </span>
          <button className="px-4 py-2 rounded-xl bg-bg-primary border border-border text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-colors">
            Download MP4
          </button>
        </div>
      </div>

      <div className="relative aspect-video rounded-3xl overflow-hidden bg-black group border border-border shadow-2xl">
        <video 
          controls 
          className="w-full h-full object-cover"
          poster={thumbnail || "/api/placeholder/1280/720"}
        >
          <source src={source} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Custom Overlay for premium feel */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-black">
              AI
            </div>
            <div>
              <p className="text-[10px] font-black text-white uppercase tracking-tight">AI Analysis Overlay</p>
              <p className="text-[8px] text-slate-400 font-bold uppercase">Confidence: 85% • Engagement: High</p>
            </div>
          </div>
        </div>

        {/* Dynamic Marker Box (Mockup of AI tracking) */}
        <motion.div 
          animate={{ 
            x: [100, 400, 200, 300],
            y: [50, 150, 100, 80]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute border-2 border-purple-500/50 w-32 h-32 rounded-2xl pointer-events-none hidden group-hover:block"
        >
          <div className="absolute -top-6 left-0 bg-purple-500 text-[8px] font-black text-white px-2 py-0.5 rounded uppercase">
            Candidate Detected
          </div>
        </motion.div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 bg-bg-primary/50 border border-border rounded-2xl">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Duration</p>
          <p className="text-xl font-black text-white">28:45</p>
        </div>
        <div className="p-4 bg-bg-primary/50 border border-border rounded-2xl">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Avg. Sentiment</p>
          <p className="text-xl font-black text-green-400">Positive</p>
        </div>
        <div className="p-4 bg-bg-primary/50 border border-border rounded-2xl">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Eye Contact</p>
          <p className="text-xl font-black text-purple-400">89%</p>
        </div>
      </div>
    </div>
  );
}
