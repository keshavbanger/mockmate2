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
          x: Math.floor(Math.random() * 5) + 1, // Mocking random distribution across questions
          y: count,
          r: count * 4 + 10, // Size based on count
        },
      ],
      backgroundColor: `rgba(239, 68, 68, ${0.2 + (count / 20)})`,
      borderColor: '#EF4444',
      borderWidth: 1,
    })),
  };

  const options = {
    scales: {
      x: {
        title: { display: true, text: 'Interview Stage', color: '#6B7280', font: { size: 10 } },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { display: false },
        min: 0,
        max: 6
      },
      y: {
        title: { display: true, text: 'Total Count', color: '#6B7280', font: { size: 10 } },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#6B7280' },
        min: 0
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.y} instances`
        }
      }
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="col-6 premium-card">
      <h3 className="section-header">Filler Word Heatmap</h3>
      <div className="h-[250px] mt-4">
        <Bubble data={data} options={options} />
      </div>
      
      <div className="mt-8 space-y-4">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Worst Habits</h4>
        <div className="space-y-3">
          {Object.entries(fillerWords).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([word, count]) => (
            <div key={word} className="flex items-center justify-between p-3 bg-bg-primary/50 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-white">"{word}"</span>
                <span className="text-[10px] text-red-400 font-black">{count} times</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">Try pausing instead</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
