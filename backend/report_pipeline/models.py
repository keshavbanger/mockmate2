from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

# --- Input Models ---

class Utterance(BaseModel):
    speaker: str  # "candidate" or "interviewer"
    text: str
    start_time: float
    end_time: float
    question_id: Optional[int] = None

class SpeechMetrics(BaseModel):
    total_words: int
    words_per_minute: float
    filler_words_count: int
    filler_words_breakdown: Dict[str, int]
    silence_durations: List[float]
    avg_pause_duration: float
    longest_pause: float
    answer_duration: float

class VisualMetrics(BaseModel):
    dominant_emotion: str
    emotion_distribution: Dict[str, float]
    eye_contact_score: float
    head_stability_score: float
    smile_frequency: float
    engagement_score: float

class ResumeData(BaseModel):
    candidate_name: str
    target_role: str
    years_experience: float
    skills: List[str]
    projects: List[Dict[str, Any]]
    tools: List[str]
    education: List[Dict[str, Any]]
    summary: str

class InterviewConfig(BaseModel):
    interview_type: str
    difficulty: str
    selected_language: str
    seniority_level: str

class QuestionBankItem(BaseModel):
    question_id: int
    question_text: str
    category: str
    expected_topics: List[str]
    expected_domain_terms: List[str]
    evaluation_focus: str

# --- Intermediate Feature Models ---

class STARResult(BaseModel):
    situation: bool
    task: bool
    action: bool
    result: bool
    completeness_score: int # 0-4

class AnswerFeature(BaseModel):
    question_id: int
    relevance_score: float
    technical_depth_score: float
    star: STARResult
    filler_count: int
    wpm: float
    dominant_emotion: str

# --- Output Report Model ---

class ScoreBreakdown(BaseModel):
    communication: float
    confidence: float
    technical: float
    role_fit: float
    grammar: float
    vocabulary: float

class ScoreConfidence(BaseModel):
    communication: str
    confidence: str
    technical: str
    role_fit: str
    grammar: str
    vocabulary: str

class ReportOutput(BaseModel):
    candidate: Dict[str, Any]
    overall_score: int
    benchmark_label: str
    score_breakdown: ScoreBreakdown
    score_confidence: ScoreConfidence
    speech_summary: Dict[str, Any]
    visual_summary: Dict[str, Any]
    grammar_analysis: Dict[str, Any]
    vocabulary_analysis: Dict[str, Any]
    resume_gap_analysis: Dict[str, Any]
    questions: List[Dict[str, Any]]
    strengths: List[str]
    areas_for_improvement: List[str]
    coaching_plan: List[Dict[str, str]]
    phrase_improvements: List[Dict[str, str]]
    executive_summary: str
    final_recommendation: str
