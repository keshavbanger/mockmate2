import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export default function RadarChart({ scores }) {
  const data = {
    labels: [
      'Grammar', 
      'Communication', 
      'Vocabulary', 
      'Eye Contact', 
      'Confidence', 
      'Role Fit'
    ],
    datasets: [
      {
        label: 'Your Performance',
        data: [
          scores.grammar,
          scores.communication,
          scores.vocabulary,
          scores.eyeContact,
          scores.confidence,
          scores.roleFit,
        ],
        backgroundColor: 'rgba(124, 58, 237, 0.3)',
        borderColor: '#7C3AED',
        borderWidth: 2,
        pointBackgroundColor: '#7C3AED',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#7C3AED',
      },
      {
        label: 'Target Benchmark',
        data: [8, 8, 8, 7, 8, 9],
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
      }
    ],
  };

  const options = {
    scales: {
      r: {
        angleLines: { color: '#1F2937' },
        grid: { color: '#1F2937' },
        pointLabels: {
          color: '#9CA3AF',
          font: { size: 11, weight: 'bold', family: 'Inter' }
        },
        ticks: { display: false, stepSize: 2 },
        min: 0,
        max: 10,
      },
    },
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

  return (
    <div className="col-4 premium-card">
      <h3 className="section-header">Performance Analysis</h3>
      <div className="h-[300px] mt-4">
        <Radar data={data} options={options} />
      </div>
    </div>
  );
}
