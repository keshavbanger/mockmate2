import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import SetupPage from './pages/SetupPage.jsx';
import InterviewRoom from './pages/InterviewRoom.jsx';
import ReportPage from './pages/ReportPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/"           element={<Dashboard />} />
      <Route path="/setup"      element={<SetupPage />} />
      <Route path="/interview"  element={<InterviewRoom />} />
      <Route path="/report"     element={<ReportPage />} />
      <Route path="*"           element={<Navigate to="/" replace />} />
    </Routes>
  );
}
