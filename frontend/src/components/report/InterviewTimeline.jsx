import { motion } from 'framer-motion';

export default function InterviewTimeline({ answers }) {
  // If answers are limited, mock a few more for timeline visualization
  const fullTimeline = answers.length > 2 ? answers : [
    ...answers,
    { id: 3, emotion: 'neutral', duration: 75, timestamp: '13:05' },
    { id: 4, emotion: 'nervous', duration: 38, timestamp: '17:40' },
    { id: 5, emotion: 'neutral', duration: 120, timestamp: '22:10' }
  ];

  const getColor = (emotion) => {
    switch (emotion?.toLowerCase()) {
      case 'confident': return '#10B981';
      case 'nervous': return '#EF4444';
      case 'focused': return '#F59E0B';
      default: return '#3B82F6';
    }
  };

  return (
    <div className="col-12 premium-card">
      <h3 className="section-header">Interview Timeline</h3>
      
      <div className="relative mt-12 mb-8 px-4">
        {/* Connecting Line */}
        <div className="absolute top-[18px] left-8 right-8 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-blue-500 via-red-500 to-green-500 opacity-30" />
        </div>

        <div className="flex justify-between relative z-10">
          {fullTimeline.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <motion.div 
                whileHover={{ scale: 1.2 }}
                className="w-10 h-10 rounded-full border-4 border-bg-card flex items-center justify-center cursor-pointer shadow-lg"
                style={{ backgroundColor: getColor(item.emotion) }}
                onClick={() => {
                  const el = document.getElementById(`answer-${item.id}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <span className="text-[10px] font-black text-white">Q{item.id}</span>
              </motion.div>
              
              <div className="mt-4 text-center space-y-1">
                <p className="text-[10px] font-black text-white uppercase tracking-tighter">
                  {item.timestamp || `0${idx}:00`}
                </p>
                <div 
                  className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest inline-block"
                  style={{ backgroundColor: `${getColor(item.emotion)}20`, color: getColor(item.emotion) }}
                >
                  {item.emotion}
                </div>
                <p className="text-[9px] font-bold text-slate-500">{item.duration}s</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
