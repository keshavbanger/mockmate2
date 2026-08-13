import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Kept eager: the two most common entry points (root landing + auth) should
// paint from the very first request, not wait on a second chunk round-trip.
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';

// Everything else is lazy: these pages pull in Monaco (~monaco-editor),
// mediapipe face-landmark detection, chart.js, and react-syntax-highlighter
// between them. Before this, ALL of it — every page, whether you were on
// them or not — shipped in one ~900KB (239KB gzip) chunk loaded on first
// paint, including for a visitor who only ever sees the landing page.
const Dashboard               = lazy(() => import('./pages/Dashboard.jsx'));
const ProfilePage             = lazy(() => import('./pages/ProfilePage.jsx'));
const SetupPage               = lazy(() => import('./pages/SetupPage.jsx'));
const InterviewRoom           = lazy(() => import('./pages/InterviewRoom.jsx'));
const ReportPage              = lazy(() => import('./pages/ReportPage.jsx'));
const ATSUploadPage           = lazy(() => import('./pages/ATSUploadPage.jsx'));
const ATSReportPage           = lazy(() => import('./pages/ATSReportPage.jsx'));
const ATSComparePage          = lazy(() => import('./pages/ATSComparePage.jsx'));
const ResumeStudioPage        = lazy(() => import('./pages/ResumeStudioPage.jsx'));
const InterviewHistoryPage    = lazy(() => import('./pages/InterviewHistoryPage.jsx'));
const TechInterviewSetupPage  = lazy(() => import('./pages/TechInterviewSetupPage.jsx'));
const TechInterviewPage       = lazy(() => import('./pages/TechInterviewPage.jsx'));
const TechInterviewReportPage = lazy(() => import('./pages/TechInterviewReportPage.jsx'));
const PricingPage             = lazy(() => import('./pages/PricingPage.jsx'));
const ChangelogPage           = lazy(() => import('./pages/ChangelogPage.jsx'));
const WhyMockMatePage         = lazy(() => import('./pages/WhyMockMatePage.jsx'));
const ContactPage             = lazy(() => import('./pages/ContactPage.jsx'));

function RouteFallback() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#f8f9fa]">
      <div className="h-10 w-10 rounded-full border-4 border-purple-100 border-t-purple-600 animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      {/* ── Public Authentication Routes ── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* ── Public Info Pages ── */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/changelog" element={<ChangelogPage />} />
      <Route path="/why-mockmate" element={<WhyMockMatePage />} />
      <Route path="/contact" element={<ContactPage />} />

      {/* ── Protected Core Interview Flow ── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <InterviewHistoryPage />
          </ProtectedRoute>
        }
      />
      {/* ── Feature Setup Pages (Publicly Exploreable) ── */}
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/ats" element={<ATSUploadPage />} />
      <Route path="/tech-interview/setup" element={<TechInterviewSetupPage />} />

      {/* ── Protected Core Interview Sessions & Reports ── */}
      <Route
        path="/interview"
        element={
          <ProtectedRoute>
            <InterviewRoom />
          </ProtectedRoute>
        }
      />
      <Route
        path="/report"
        element={
          <ProtectedRoute>
            <ReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/report/:sessionId"
        element={
          <ProtectedRoute>
            <ReportPage />
          </ProtectedRoute>
        }
      />

      {/* ── Protected ATS Reports & Studio ── */}
      <Route
        path="/ats/report/:reportId"
        element={
          <ProtectedRoute>
            <ATSReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ats/studio/:reportId"
        element={
          <ProtectedRoute>
            <ResumeStudioPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ats/compare"
        element={
          <ProtectedRoute>
            <ATSComparePage />
          </ProtectedRoute>
        }
      />

      {/* ── Protected Technical Interview Sessions & Reports ── */}
      <Route
        path="/tech-interview/:sessionId"
        element={
          <ProtectedRoute>
            <TechInterviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tech-interview/report/:sessionId"
        element={
          <ProtectedRoute>
            <TechInterviewReportPage />
          </ProtectedRoute>
        }
      />

      {/* ── Fallback ── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
