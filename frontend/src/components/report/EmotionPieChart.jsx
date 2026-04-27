import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function EmotionPieChart({ distribution, dominant }) {
  const data = {
    labels: ['Neutral', 'Confident', 'Nervous', 'Focused'],
    datasets: [
      {
        data: [
          distribution.neutral,
          distribution.confident,
          distribution.nervous,
          distribution.focused
        ],
        backgroundColor: ['#3B82F6', '#10B981', '#EF4444', '#F59E0B'],
        borderColor: '#111827',
        borderWidth: 4,
        hoverOffset: 10,
      },
    ],
  };

  const options = {
    cutout: '75%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111827',
        titleFont: { family: 'Inter', weight: 'bold' },
        bodyFont: { family: 'Inter' },
        borderColor: '#1F2937',
        borderWidth: 1,
      }
    },
    maintainAspectRatio: false,
  };

  const getEmoji = (emotion) => {
    switch (emotion.toLowerCase()) {
      case 'confident': return '😎';
      case 'nervous': return '😰';
      case 'focused': return '🧐';
      default: return '😐';
    }
  };

  return (
    <div className="col-4 premium-card">
      <h3 className="section-header">Emotional State Distribution</h3>
      <div className="relative h-[250px] mt-4">
        <Doughnut data={data} options={options} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-4xl mb-1">{getEmoji(dominant)}</span>
          <span className="text-sm font-black text-white tracking-tight">{dominant}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-y-3 mt-6">
        {data.labels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.datasets[0].backgroundColor[i] }} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
            <span className="text-[11px] font-bold text-white ml-auto">{data.datasets[0].data[i]}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
