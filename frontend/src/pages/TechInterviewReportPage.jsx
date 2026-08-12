import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTechInterviewReport } from '../utils/api';
import useBackNavigationGuard from '../hooks/useBackNavigationGuard';

const HIRING_COLORS = {
  STRONG_HIRE:    { bg: '#ecfdf5', border: '#10B981', text: '#059669' },
  HIRE:           { bg: '#eff6ff', border: '#3B82F6', text: '#2563eb' },
  BORDERLINE:     { bg: '#fffbeb', border: '#F59E0B', text: '#b45309' },
  NO_HIRE:        { bg: '#fef2f2', border: '#EF4444', text: '#dc2626' },
  STRONG_NO_HIRE: { bg: '#fef2f2', border: '#991B1B', text: '#991B1B' },
};

const ScoreBar = ({ label, score, max = 100 }) => {
  const color = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ color: '#374151', fontSize: '14px' }}>{label}</span>
        <span style={{ color, fontWeight: 700, fontSize: '14px' }}>{score}/{max}</span>
      </div>
      <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          width: `${(score / max) * 100}%`, height: '8px',
          background: `linear-gradient(90deg, ${color}, ${color}99)`,
          borderRadius: '4px',
          transition: 'width 1s ease',
        }} />
      </div>
    </div>
  );
};

export default function TechInterviewReportPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // The interview behind this report is already over — back/forward should
  // not be able to reopen a dead session; send it to the dashboard instead.
  useBackNavigationGuard({ fallbackTo: '/dashboard' });

  useEffect(() => {
    getTechInterviewReport(sessionId)
      .then(({ data }) => setReport(data))
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
          <div style={{ color: '#111827', fontSize: '18px', fontWeight: 600 }}>Generating your report...</div>
          <div style={{ color: '#6b7280', marginTop: '8px' }}>This may take up to 30 seconds</div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#EF4444', marginBottom: '20px' }}>{error || 'Report not found'}</div>
          <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
        </div>
      </div>
    );
  }

  const decision     = report.hiringDecision || 'BORDERLINE';
  const decisionColor = HIRING_COLORS[decision] || HIRING_COLORS.BORDERLINE;
  const categories   = report.scoreByCategory || {};
  const dsaReviews   = report.dsaReviews || [];
  const sqlReviews   = report.sqlReviews || [];
  const strengths    = report.topStrengths || [];
  const weaknesses   = report.topWeaknesses || [];
  const studyPlan    = report.studyPlan;
  const companyReady = report.companyReadiness || [];

  const TABS = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'dsa', label: `💻 DSA (${dsaReviews.length})` },
    { key: 'sql', label: `🗃️ SQL (${sqlReviews.length})` },
    { key: 'insights', label: '💡 Insights' },
    { key: 'study', label: '📚 Study Plan' },
    { key: 'transcript', label: '📝 Transcript' },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.reportHeader}>
          <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>← Dashboard</button>
          <div style={styles.reportMeta}>
            <span>{report.interviewType?.replace('_', ' ')} Interview</span>
            <span>•</span>
            <span>{report.roleLevel?.replace('_', '-')}</span>
            <span>•</span>
            <span>{report.companyStyle}</span>
            <span>•</span>
            <span>{report.interviewDurationMinutes}m</span>
          </div>
        </div>

        {/* Hero: Overall Score + Hiring Decision */}
        <div style={styles.heroCard}>
          <div style={styles.scoreCircle}>
            <div style={styles.scoreNum}>{report.overallScore}</div>
            <div style={styles.scoreLabel}>/ 100</div>
          </div>
          <div style={styles.heroMid}>
            <div style={{ ...styles.decisionBadge, ...decisionColor }}>
              {report.hiringDecisionLabel || decision.replace('_', ' ')}
            </div>
            <div style={styles.decisionReason}>{report.hiringDecisionReason}</div>
            {report.dealBreakerTriggered && (
              <div style={styles.dealBreakerAlert}>
                ⚠️ Deal-breaker: {report.dealBreakerReason}
              </div>
            )}
          </div>
          <div style={styles.heroRight}>
            <div style={{ color: '#9CA3AF', fontSize: '13px', marginBottom: '8px' }}>Score Breakdown</div>
            {Object.entries(categories).map(([cat, score]) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#374151', fontSize: '13px' }}>{cat}</span>
                <span style={{
                  color: score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444',
                  fontWeight: 700, fontSize: '13px'
                }}>{score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabBar}>
          {TABS.map(t => (
            <button key={t.key}
              style={{ ...styles.tabBtn, ...(activeTab === t.key ? styles.tabBtnActive : {}) }}
              onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <div>
            <div style={styles.grid2}>
              <div style={styles.card}>
                <div style={styles.cardTitle}>📈 Category Scores</div>
                {Object.entries(categories).map(([cat, score]) => (
                  <ScoreBar key={cat} label={cat} score={score} />
                ))}
              </div>
              <div style={styles.card}>
                <div style={styles.cardTitle}>🏢 Company Readiness</div>
                {companyReady.map(c => (
                  <div key={c.company} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: '#374151', fontSize: '14px' }}>{c.company}</span>
                      <span style={{ color: '#111827', fontWeight: 700, fontSize: '14px' }}>
                        {c.readinessPercent}%
                      </span>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${c.readinessPercent}%`, height: '6px',
                        background: 'linear-gradient(90deg, #6B46C1, #9F7AEA)',
                      }} />
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '4px' }}>{c.assessment}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: DSA */}
        {activeTab === 'dsa' && (
          <div>
            {dsaReviews.length === 0 ? (
              <div style={styles.emptyState}>No DSA problems attempted.</div>
            ) : dsaReviews.map(r => (
              <div key={r.problemId} style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={styles.dsaTitle}>
                      <a href={r.leetcodeUrl} target="_blank" rel="noreferrer" style={{ color: '#6B46C1', textDecoration: 'none' }}>
                        LC-{r.leetcodeId}: {r.problemTitle}
                      </a>
                    </h3>
                    <span style={{ color: r.difficulty === 'HARD' ? '#EF4444' : r.difficulty === 'MEDIUM' ? '#F59E0B' : '#10B981', fontSize: '12px', fontWeight: 700 }}>
                      {r.difficulty}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: r.score >= 70 ? '#10B981' : r.score >= 40 ? '#F59E0B' : '#EF4444' }}>
                      {r.score}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '11px' }}>/ 100</div>
                  </div>
                </div>

                <div style={styles.dsaGrid}>
                  <div style={styles.dsaStat}>
                    <div style={styles.dsaStatLabel}>Test Cases</div>
                    <div style={{ color: r.allPassed ? '#10B981' : '#F59E0B', fontWeight: 700 }}>
                      {r.testCasesPassed}/{r.totalTestCases}
                    </div>
                  </div>
                  <div style={styles.dsaStat}>
                    <div style={styles.dsaStatLabel}>Approach</div>
                    <div style={{ color: r.approachQuality === 'OPTIMAL' ? '#10B981' : '#F59E0B', fontWeight: 700 }}>
                      {r.approachQuality}
                    </div>
                  </div>
                  <div style={styles.dsaStat}>
                    <div style={styles.dsaStatLabel}>Time Complexity</div>
                    <div style={{ color: '#111827' }}>{r.timeComplexityAnswer || '—'}</div>
                  </div>
                  <div style={styles.dsaStat}>
                    <div style={styles.dsaStatLabel}>Hints Used</div>
                    <div style={{ color: r.hintsUsed > 0 ? '#F59E0B' : '#10B981' }}>{r.hintsUsed}</div>
                  </div>
                </div>

                {r.optimalApproach && (
                  <div style={styles.optimalBox}>
                    <div style={{ color: '#10B981', fontWeight: 700, marginBottom: '6px', fontSize: '13px' }}>
                      ✅ Optimal Approach: {r.optimalTimeComplexity} time / {r.optimalSpaceComplexity} space
                    </div>
                    <div style={{ color: '#374151', fontSize: '13px' }}>{r.optimalApproach}</div>
                  </div>
                )}

                {r.modelSolution?.java && (
                  <details style={{ marginTop: '12px' }}>
                    <summary style={{ color: '#6B7280', cursor: 'pointer', fontSize: '13px' }}>Show Model Solution (Java)</summary>
                    <pre style={styles.codeBlock}>{r.modelSolution.java}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab: SQL */}
        {activeTab === 'sql' && (
          <div>
            {sqlReviews.length === 0 ? (
              <div style={styles.emptyState}>No SQL problems attempted.</div>
            ) : sqlReviews.map((r, i) => (
              <div key={r.problemId || i} style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={styles.dsaTitle}>{r.question || r.problemId}</h3>
                    <span style={{ color: r.isCorrect ? '#10B981' : '#EF4444', fontSize: '12px', fontWeight: 700 }}>
                      {r.isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: r.score >= 70 ? '#10B981' : r.score >= 40 ? '#F59E0B' : '#EF4444' }}>
                      {r.score}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '11px' }}>/ 100</div>
                  </div>
                </div>

                {r.feedback && (
                  <div style={{ color: '#374151', fontSize: '13px', marginBottom: '14px' }}>{r.feedback}</div>
                )}

                <div style={{ color: '#6B7280', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 700 }}>
                  Your Query
                </div>
                <pre style={styles.codeBlock}>{r.candidateQuery || '—'}</pre>

                {r.correctQuery && (
                  <>
                    <div style={{ color: '#6B7280', fontSize: '11px', margin: '14px 0 6px', textTransform: 'uppercase', fontWeight: 700 }}>
                      Reference Query
                    </div>
                    <pre style={styles.codeBlock}>{r.correctQuery}</pre>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab: Insights */}
        {activeTab === 'insights' && (
          <div style={styles.grid2}>
            <div style={styles.card}>
              <div style={styles.cardTitle}>💪 Top Strengths</div>
              {strengths.length === 0 ? <div style={styles.emptyState}>No strengths noted.</div> :
                strengths.map((s, i) => (
                  <div key={i} style={styles.insightItem}>
                    <div style={{ color: '#10B981', fontWeight: 700, marginBottom: '4px' }}>✓ {s.strength}</div>
                    {s.evidence && <div style={{ color: '#6B7280', fontSize: '13px' }}>{s.evidence}</div>}
                  </div>
                ))}
            </div>
            <div style={styles.card}>
              <div style={styles.cardTitle}>🔧 Areas to Improve</div>
              {weaknesses.length === 0 ? <div style={styles.emptyState}>No major weaknesses.</div> :
                weaknesses.map((w, i) => (
                  <div key={i} style={styles.insightItem}>
                    <div style={{ color: '#EF4444', fontWeight: 700, marginBottom: '4px' }}>✗ {w.weakness}</div>
                    {w.fix && <div style={{ color: '#374151', fontSize: '13px', marginBottom: '4px' }}>Fix: {w.fix}</div>}
                    {w.resources && <div style={{ color: '#9CA3AF', fontSize: '12px' }}>{w.resources}</div>}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Tab: Study Plan */}
        {activeTab === 'study' && studyPlan && (
          <div>
            <div style={styles.grid2}>
              {['week1', 'week2', 'week3', 'week4'].map((week, i) => (
                <div key={week} style={styles.card}>
                  <div style={styles.cardTitle}>Week {i + 1}</div>
                  <div style={{ color: '#374151', fontSize: '14px', lineHeight: '1.7' }}>{studyPlan[week]}</div>
                </div>
              ))}
            </div>
            {studyPlan.leetcodeListsToComplete?.length > 0 && (
              <div style={styles.card}>
                <div style={styles.cardTitle}>📋 LeetCode Lists to Complete</div>
                <div style={styles.tagCloud}>
                  {studyPlan.leetcodeListsToComplete.map(l => (
                    <span key={l} style={styles.planTag}>{l}</span>
                  ))}
                </div>
              </div>
            )}
            {studyPlan.resourceLinks?.length > 0 && (
              <div style={styles.card}>
                <div style={styles.cardTitle}>🔗 Resources</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {studyPlan.resourceLinks.map(link => (
                    <a key={link} href={link} target="_blank" rel="noreferrer"
                      style={{ color: '#3B82F6', fontSize: '14px' }}>{link}</a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Transcript */}
        {activeTab === 'transcript' && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>Full Interview Transcript</div>
            {(report.fullTranscript || []).length === 0 ? (
              <div style={styles.emptyState}>No transcript available.</div>
            ) : (
              (report.fullTranscript || []).map((turn, i) => (
                <div key={i} style={styles.transcriptTurn}>
                  {turn.question && (
                    <div style={styles.transcriptQ}>
                      <span style={styles.tBadge}>AI</span> {turn.question}
                    </div>
                  )}
                  {turn.candidateAnswer && (
                    <div style={styles.transcriptA}>
                      <span style={{ ...styles.tBadge, background: '#3B82F622', color: '#93C5FD' }}>You</span>
                      {turn.candidateAnswer}
                    </div>
                  )}
                  {turn.score > 0 && (
                    <div style={styles.transcriptScore}>
                      Score: {turn.score}/100 • {turn.quality} • {turn.topicAssessed}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#fafafa', padding: '32px 20px', fontFamily: "'Outfit', 'Inter', sans-serif" },
  container: { maxWidth: '1100px', margin: '0 auto' },
  reportHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  backBtn: { background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', color: '#374151', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px' },
  reportMeta: { display: 'flex', gap: '10px', color: '#6B7280', fontSize: '13px', alignItems: 'center' },
  heroCard: {
    display: 'grid', gridTemplateColumns: 'auto 1fr auto',
    gap: '32px', background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.06)', borderRadius: '20px',
    padding: '32px', marginBottom: '28px', alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  scoreCircle: { textAlign: 'center' },
  scoreNum: { fontSize: '72px', fontWeight: 900, color: '#111827', lineHeight: 1 },
  scoreLabel: { color: '#6B7280', fontSize: '14px' },
  heroMid: { display: 'flex', flexDirection: 'column', gap: '12px' },
  decisionBadge: {
    display: 'inline-block', padding: '10px 24px', borderRadius: '12px',
    fontSize: '18px', fontWeight: 800, border: '2px solid', textTransform: 'uppercase',
  },
  decisionReason: { color: '#374151', fontSize: '15px', lineHeight: '1.6' },
  dealBreakerAlert: { background: '#fef2f2', border: '1px solid #EF4444', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '13px' },
  heroRight: { minWidth: '200px' },
  tabBar: { display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' },
  tabBtn: {
    background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)',
    color: '#6B7280', borderRadius: '8px', padding: '8px 16px',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  tabBtnActive: { background: '#F3E8FF', borderColor: '#6B46C1', color: '#6B46C1' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' },
  card: {
    background: '#ffffff', border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: '14px', padding: '22px', marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cardTitle: { color: '#111827', fontWeight: 700, fontSize: '15px', marginBottom: '18px' },
  emptyState: { color: '#4B5563', fontSize: '14px', textAlign: 'center', padding: '20px' },
  dsaTitle: { color: '#111827', fontSize: '16px', fontWeight: 700, margin: '0 0 6px' },
  dsaGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' },
  dsaStat: { background: '#fafafa', borderRadius: '8px', padding: '10px 12px' },
  dsaStatLabel: { color: '#6B7280', fontSize: '11px', marginBottom: '4px' },
  optimalBox: { background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '14px', marginTop: '12px' },
  codeBlock: { background: '#fafafa', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '8px', padding: '12px', color: '#111827', fontSize: '12px', overflowX: 'auto', fontFamily: 'monospace', marginTop: '10px' },
  insightItem: { background: '#fafafa', borderRadius: '8px', padding: '12px', marginBottom: '10px' },
  tagCloud: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  planTag: { background: '#F3E8FF', color: '#6B46C1', padding: '5px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 },
  transcriptTurn: { borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '16px', marginBottom: '16px' },
  transcriptQ: { color: '#111827', fontSize: '14px', lineHeight: '1.6', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' },
  transcriptA: { color: '#374151', fontSize: '14px', lineHeight: '1.6', display: 'flex', gap: '8px', alignItems: 'flex-start' },
  transcriptScore: { color: '#6B7280', fontSize: '12px', marginTop: '8px', fontStyle: 'italic' },
  tBadge: { background: '#6B46C122', color: '#6B46C1', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, flexShrink: 0, marginTop: '2px' },
};
