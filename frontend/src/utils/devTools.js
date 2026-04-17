/**
 * Development API utilities for testing and debugging
 * Only available in development mode
 */

import api from './api.js';

/**
 * Inject realistic test data into a session
 * Useful for testing report generation without running full interviews
 */
export async function injectTestData(sessionId, options = {}) {
  const {
    questionsCount = 7,
    answersCount = 7,
    emotionSnapshotsCount = 50,
  } = options;

  try {
    const { data } = await api.post('/dev/inject-test-data', {
      session_id: sessionId,
      questions_count: questionsCount,
      answers_count: answersCount,
      emotion_snapshots_count: emotionSnapshotsCount,
    });
    
    console.log('✅ Test data injected:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to inject test data:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get raw session data for inspection
 */
export async function getSessionData(sessionId) {
  try {
    const { data } = await api.get(`/dev/session/${sessionId}/data`);
    return data;
  } catch (error) {
    if (error.response?.status === 403) {
      console.warn('Dev endpoints not available (not in development mode)');
    } else {
      console.error('Failed to fetch session data:', error);
    }
    throw error;
  }
}

/**
 * Quick test: Inject data and generate report to verify pipeline
 */
export async function quickTestReportPipeline(sessionId) {
  try {
    console.group('🧪 Quick Test: Report Pipeline');
    
    console.log('1️⃣ Injecting test data...');
    await injectTestData(sessionId);
    
    console.log('2️⃣ Generating report...');
    const reportResponse = await api.post('/generate-report', { session_id: sessionId });
    const report = reportResponse.data;
    
    console.log('3️⃣ Verifying report has real data...');
    const issues = [];
    
    if (!report.executive_summary) {
      issues.push('❌ No executive summary');
    } else {
      console.log('✅ Executive summary:', report.executive_summary.substring(0, 100) + '...');
    }
    
    if (!report.question_feedback || report.question_feedback.length === 0) {
      issues.push('❌ No question feedback');
    } else {
      console.log(`✅ Question feedback: ${report.question_feedback.length} questions analyzed`);
    }
    
    if (!report.scores) {
      issues.push('❌ No scores');
    } else {
      console.log('✅ Scores:', report.scores);
    }
    
    if (issues.length === 0) {
      console.log('✅ Report pipeline working correctly!');
    } else {
      console.warn('⚠️ Issues found:', issues);
    }
    
    console.groupEnd();
    return report;
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}
