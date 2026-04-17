/**
 * Diagnostic utilities for troubleshooting session data flow
 */

import api from './api.js';

/**
 * Get detailed diagnostics about the current session
 * Shows what data has been collected and what's missing
 */
export async function getSessionDiagnostics(sessionId) {
  try {
    const { data } = await api.get(`/session/${sessionId}/diagnostics`);
    return data;
  } catch (error) {
    console.error('Failed to fetch diagnostics:', error);
    throw error;
  }
}

/**
 * Pretty print diagnostics to console
 */
export function printDiagnostics(diagnostics) {
  console.group('🔍 Session Diagnostics');
  
  console.group('📊 Data Status');
  const { data_status } = diagnostics;
  console.table({
    'Resume Uploaded': data_status.resume_uploaded ? '✅' : '❌',
    'Candidate Name': data_status.candidate_name,
    'Questions': data_status.questions_count,
    'Transcript Turns': data_status.turns_count,
    'Interviewer Turns': data_status.interviewer_turns,
    'Candidate Answers': data_status.candidate_turns,
    'Emotion Snapshots': data_status.emotion_snapshots_count,
    'Duration (sec)': data_status.interview_duration_seconds,
  });
  console.groupEnd();
  
  if (data_status.questions_sample.length > 0) {
    console.group('📝 Sample Questions');
    data_status.questions_sample.forEach((q, i) => {
      console.log(`Q${i + 1}: ${q.substring(0, 80)}...`);
    });
    console.groupEnd();
  }
  
  console.group('🎙️ Tavus Status');
  const { tavus_status } = diagnostics;
  console.table({
    'Persona ID': tavus_status.persona_id || 'NOT SET',
    'Conversation ID': tavus_status.conversation_id || 'NOT SET',
    'Conversation URL': tavus_status.conversation_url ? '✅' : '❌',
  });
  console.groupEnd();
  
  console.group('⚠️ Issues Detected');
  const { data_quality } = diagnostics;
  data_quality.issues.forEach(issue => {
    console.log(issue);
  });
  console.log(`Ready for Report: ${data_quality.ready_for_report ? '✅ YES' : '❌ NO'}`);
  console.groupEnd();
  
  console.groupEnd();
}

/**
 * Check if session has all required data for report generation
 */
export function isSessionReadyForReport(diagnostics) {
  const { data_quality, data_status } = diagnostics;
  
  const requirements = {
    has_questions: data_status.questions_count > 0,
    has_turns: data_status.turns_count > 0,
    has_answers: data_status.candidate_turns > 0,
    interview_ended: diagnostics.status === 'completed',
  };
  
  const all_met = Object.values(requirements).every(v => v);
  
  return {
    ready: all_met && data_quality.ready_for_report,
    requirements,
    issues: data_quality.issues,
  };
}

/**
 * Log data flow during interview
 * Call this periodically to monitor what's being collected
 */
export async function logInterviewProgress(sessionId) {
  try {
    const diag = await getSessionDiagnostics(sessionId);
    const { data_status } = diag;
    
    console.log(`[${new Date().toLocaleTimeString()}] Interview Progress:`, {
      turns: data_status.turns_count,
      candidate_answers: data_status.candidate_turns,
      emotions: data_status.emotion_snapshots_count,
      duration_sec: data_status.interview_duration_seconds,
    });
    
    return diag;
  } catch (error) {
    console.error('Error logging interview progress:', error);
  }
}
