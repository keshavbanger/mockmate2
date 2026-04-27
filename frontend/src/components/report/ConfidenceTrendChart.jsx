import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export default function ConfidenceTrendChart({ trend }) {
  const data = {
    labels: trend.map((_, i) => `Q${i + 1}`),
    datasets: [
      {
        label: 'Confidence Score',
        data: trend,
        fill: true,
        borderColor: '#7C3AED',
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(124, 58, 237, 0.4)');
          gradient.addColorStop(1, 'rgba(124, 58, 237, 0)');
          return gradient;
        },
        tension: 0.4,
        pointBackgroundColor: '#7C3AED',
        pointBorderColor: '#fff',
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 0,
        max: 10,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#6B7280', font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#6B7280', font: { size: 10 } }
      }
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
    }
  };

  return (
    <div className="col-8 premium-card">
      <h3 className="section-header">Confidence Across Interview</h3>
      <div className="h-[250px] mt-4">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
