import { createContext, useContext, useReducer, useCallback } from 'react';

// ─── Initial State ────────────────────────────────────────────────────────────
const initialState = {
  sessionId: null,
  resumeData: null,
  questions: [],
  interviewConfig: { type: 'Technical', difficulty: 'Mid', language: 'English' },
  conversationUrl: null,
  conversationId: null,
  sessionMetrics: {
    transcript: '',          // full rolling transcript text
    fillerCounts: {},        // { word: count }
    totalFillers: 0,
    wpm: 0,
    emotionSnapshots: [],    // [{ timestamp_ms, emotions, gaze, confidence_score }]
    currentEmotion: 'Neutral',
    currentConfidence: 0,
    turns: [],               // saved Q&A turns
    startTime: null,
    endTime: null,
    status: null,            // 'active', 'completed', etc.
    recordingPath: null,     // path to uploaded recording on server
    currentQuestionIndex: 0, // current question being answered
  },
  reportData: null,
};

// ─── Action Types ─────────────────────────────────────────────────────────────
const A = {
  SET_SESSION_ID:       'SET_SESSION_ID',
  SET_RESUME_DATA:      'SET_RESUME_DATA',
  SET_QUESTIONS:        'SET_QUESTIONS',
  SET_INTERVIEW_CONFIG: 'SET_INTERVIEW_CONFIG',
  SET_CONVERSATION:     'SET_CONVERSATION',
  UPDATE_TRANSCRIPT:    'UPDATE_TRANSCRIPT',
  UPDATE_FILLER_COUNTS: 'UPDATE_FILLER_COUNTS',
  UPDATE_WPM:           'UPDATE_WPM',
  PUSH_EMOTION_SNAPSHOT:'PUSH_EMOTION_SNAPSHOT',
  SET_CURRENT_EMOTION:  'SET_CURRENT_EMOTION',
  PUSH_TURN:            'PUSH_TURN',
  SET_START_TIME:       'SET_START_TIME',
  SET_END_TIME:         'SET_END_TIME',
  SET_REPORT_DATA:      'SET_REPORT_DATA',
  SET_STATUS:           'SET_STATUS',
  SET_RECORDING_UPLOADED: 'SET_RECORDING_UPLOADED',
  SET_CURRENT_QUESTION: 'SET_CURRENT_QUESTION',
  RESET:                'RESET',
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case A.SET_SESSION_ID:
      return { ...state, sessionId: action.payload };

    case A.SET_RESUME_DATA:
      return { ...state, resumeData: action.payload };

    case A.SET_QUESTIONS:
      return { ...state, questions: action.payload };

    case A.SET_INTERVIEW_CONFIG:
      return { ...state, interviewConfig: { ...state.interviewConfig, ...action.payload } };

    case A.SET_CONVERSATION:
      return {
        ...state,
        conversationUrl: action.payload.conversationUrl,
        conversationId:  action.payload.conversationId,
      };

    case A.UPDATE_TRANSCRIPT:
      return {
        ...state,
        sessionMetrics: {
          ...state.sessionMetrics,
          transcript: state.sessionMetrics.transcript + ' ' + action.payload,
        },
      };

    case A.UPDATE_FILLER_COUNTS:
      return {
        ...state,
        sessionMetrics: {
          ...state.sessionMetrics,
          fillerCounts:  action.payload.counts,
          totalFillers:  action.payload.total,
        },
      };

    case A.UPDATE_WPM:
      return {
        ...state,
        sessionMetrics: { ...state.sessionMetrics, wpm: action.payload },
      };

    case A.PUSH_EMOTION_SNAPSHOT:
      return {
        ...state,
        sessionMetrics: {
          ...state.sessionMetrics,
          emotionSnapshots: [...state.sessionMetrics.emotionSnapshots, action.payload],
        },
      };

    case A.SET_CURRENT_EMOTION:
      return {
        ...state,
        sessionMetrics: {
          ...state.sessionMetrics,
          currentEmotion:     action.payload.emotion,
          currentConfidence:  action.payload.confidence,
        },
      };

    case A.PUSH_TURN:
      return {
        ...state,
        sessionMetrics: {
          ...state.sessionMetrics,
          turns: [...state.sessionMetrics.turns, action.payload],
        },
      };

    case A.SET_START_TIME:
      return {
        ...state,
        sessionMetrics: { ...state.sessionMetrics, startTime: action.payload },
      };

    case A.SET_END_TIME:
      return {
        ...state,
        sessionMetrics: { ...state.sessionMetrics, endTime: action.payload },
      };

    case A.SET_REPORT_DATA:
      return { ...state, reportData: action.payload };

    case A.SET_STATUS:
      return {
        ...state,
        sessionMetrics: { ...state.sessionMetrics, status: action.payload },
      };

    case A.SET_RECORDING_UPLOADED:
      return {
        ...state,
        sessionMetrics: { ...state.sessionMetrics, recordingPath: action.payload },
      };

    case A.SET_CURRENT_QUESTION:
      return {
        ...state,
        sessionMetrics: { ...state.sessionMetrics, currentQuestionIndex: action.payload },
      };

    case A.RESET:
      return { ...initialState };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const InterviewContext = createContext(null);

export function InterviewProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ── Action creators ─────────────────────────────────────────────────────────
  const setSessionId      = useCallback((id)   => dispatch({ type: A.SET_SESSION_ID,       payload: id }),    []);
  const setResumeData     = useCallback((data) => dispatch({ type: A.SET_RESUME_DATA,      payload: data }),  []);
  const setQuestions      = useCallback((qs)   => dispatch({ type: A.SET_QUESTIONS,        payload: qs }),    []);
  const setInterviewConfig= useCallback((cfg)  => dispatch({ type: A.SET_INTERVIEW_CONFIG, payload: cfg }),   []);
  const setConversation   = useCallback((payload) => dispatch({ type: A.SET_CONVERSATION,  payload }),        []);
  const updateTranscript  = useCallback((text) => dispatch({ type: A.UPDATE_TRANSCRIPT,    payload: text }),  []);
  const updateFillerCounts= useCallback((counts, total) =>
    dispatch({ type: A.UPDATE_FILLER_COUNTS, payload: { counts, total } }), []);
  const updateWPM         = useCallback((wpm)  => dispatch({ type: A.UPDATE_WPM,           payload: wpm }),   []);
  const pushEmotionSnapshot = useCallback((snap) =>
    dispatch({ type: A.PUSH_EMOTION_SNAPSHOT, payload: snap }), []);
  const setCurrentEmotion = useCallback((emotion, confidence) =>
    dispatch({ type: A.SET_CURRENT_EMOTION, payload: { emotion, confidence } }), []);
  const pushTurn          = useCallback((turn) => dispatch({ type: A.PUSH_TURN,            payload: turn }),  []);
  const setStartTime      = useCallback((t)    => dispatch({ type: A.SET_START_TIME,       payload: t }),     []);
  const setEndTime        = useCallback((t)    => dispatch({ type: A.SET_END_TIME,         payload: t }),     []);
  const setReportData     = useCallback((data) => dispatch({ type: A.SET_REPORT_DATA,      payload: data }),  []);
  const setStatus         = useCallback((status) => dispatch({ type: A.SET_STATUS,         payload: status }), []);
  const setRecordingUploaded = useCallback((path) => dispatch({ type: A.SET_RECORDING_UPLOADED, payload: path }), []);
  const setCurrentQuestion = useCallback((idx)  => dispatch({ type: A.SET_CURRENT_QUESTION,  payload: idx }),  []);
  const reset             = useCallback(()     => dispatch({ type: A.RESET }),                                []);

  return (
    <InterviewContext.Provider value={{
      ...state,
      setSessionId,
      setResumeData,
      setQuestions,
      setInterviewConfig,
      setConversation,
      updateTranscript,
      updateFillerCounts,
      updateWPM,
      pushEmotionSnapshot,
      setCurrentEmotion,
      pushTurn,
      setStartTime,
      setEndTime,
      setReportData,
      setStatus,
      setRecordingUploaded,
      setCurrentQuestion,
      reset,
    }}>
      {children}
    </InterviewContext.Provider>
  );
}

export function useInterview() {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error('useInterview must be used within an InterviewProvider');
  return ctx;
}
