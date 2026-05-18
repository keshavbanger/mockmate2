import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function EmotionPieChart({ distribution, dominant }) {
  const data = {
    labels: ['Neutral', 'Confident', 'Nervous', 'Focused'],
    datasets: [
      {
        data: [
          distribution.neutral || 0,
          distribution.confident || 0,
          distribution.nervous || 0,
          distribution.focused || 0
        ],
        backgroundColor: ['#94A3B8', '#4F46E5', '#EF4444', '#6366F1'],
        borderColor: '#FFFFFF',
        borderWidth: 2,
        hoverOffset: 10,
      },
    ],
  };

  const options = {
    cutout: '75%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F172A',
        titleFont: { family: 'Inter', weight: 'bold' },
        bodyFont: { family: 'Inter' },
        padding: 12,
      }
    },
    maintainAspectRatio: false,
  };

  const getEmoji = (emotion) => {
    switch (emotion?.toLowerCase()) {
      case 'confident': return '😎';
      case 'nervous': return '😰';
      case 'focused': return '🧐';
      default: return '😐';
    }
  };

  return (
    <div className="premium-card h-full">
      <h3 className="section-title">Sentiment Audit</h3>
      <div className="relative h-[250px] my-6">
        <Doughnut data={data} options={options} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-4xl mb-1">{getEmoji(dominant)}</span>
          <span className="text-xs font-black text-slate-900 uppercase tracking-widest">{dominant}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-6">
        {data.labels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.datasets[0].backgroundColor[i] }} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
            <span className="text-[11px] font-black text-slate-900 ml-auto">{data.datasets[0].data[i]}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
