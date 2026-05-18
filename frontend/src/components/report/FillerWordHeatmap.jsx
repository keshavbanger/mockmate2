import { Bubble } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

export default function FillerWordHeatmap({ fillerWords }) {
  const data = {
    datasets: Object.entries(fillerWords).map(([word, count], i) => ({
      label: word,
      data: [
        {
          x: Math.floor(Math.random() * 5) + 1, 
          y: count,
          r: count * 4 + 10, 
        },
      ],
      backgroundColor: `rgba(79, 70, 229, ${0.1 + (count / 30)})`, // Indigo base
      borderColor: '#4F46E5',
      borderWidth: 1,
    })),
  };

  const options = {
    scales: {
      x: {
        title: { display: true, text: 'Interview Progression', color: '#94A3B8', font: { size: 9, weight: 'bold' } },
        grid: { color: '#F1F5F9' },
        ticks: { display: false },
        min: 0,
        max: 6
      },
      y: {
        title: { display: true, text: 'Frequency', color: '#94A3B8', font: { size: 9, weight: 'bold' } },
        grid: { color: '#F1F5F9' },
        ticks: { color: '#94A3B8', font: { size: 10 } },
        min: 0
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F172A',
        titleFont: { size: 12, weight: 'black' },
        padding: 12,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.y} instances`
        }
      }
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="premium-card h-full">
      <h3 className="section-title">Fluency Audit</h3>
      <div className="h-[200px] mt-6">
        <Bubble data={data} options={options} />
      </div>
      
      <div className="mt-10 space-y-4">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identified Speech Habits</h4>
        <div className="space-y-2">
          {Object.entries(fillerWords).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([word, count]) => (
            <div key={word} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-lg">
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-900">"{word}"</span>
                <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded font-black tracking-widest">{count}X</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Action: Controlled Pause</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
