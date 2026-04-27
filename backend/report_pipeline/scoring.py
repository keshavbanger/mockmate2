from typing import Dict, List
from .models import ScoreBreakdown, ScoreConfidence

class ScoringEngine:
    def __init__(self, config: Dict = None):
        # Default weights
        self.weights = config or {
            "filler_ratio": 0.4,
            "pace_stability": 0.3,
            "visual_engagement": 0.3,
            "star_completeness": 0.5,
            "relevance": 0.5,
        }

    def compute_all_scores(self, features: Dict) -> ScoreBreakdown:
        # 1. Communication (0-10)
        comm = (features["fluency"]["fluency_score"] * 0.6) + (features["pace_stability"] * 10 * 0.4)
        
        # 2. Confidence (0-10)
        # Combine eye contact and fluency
        conf = (features["visual"]["avg_eye_contact_score"] * 10 * 0.6) + (features["fluency"]["fluency_score"] * 0.4)
        
        # 3. Technical (0-10)
        tech = (features["avg_star_score"] / 4 * 10 * 0.5) + (features["resume_gap"]["gap_score"] * 10 * 0.5)
        
        # 4. Role Fit (0-10)
        fit = (features["avg_star_score"] / 4 * 10 * 0.7) + (features["resume_gap"]["gap_score"] * 10 * 0.3)
        
        # 5. Grammar (0-10)
        # Mocking grammar score for now
        grammar = 8.0 
        
        # 6. Vocabulary (0-10)
        vocab = features["transcript"]["type_token_ratio"] * 15 # Scaling TTR to 0-10
        
        return ScoreBreakdown(
            communication=round(min(10, comm), 1),
            confidence=round(min(10, conf), 1),
            technical=round(min(10, tech), 1),
            role_fit=round(min(10, fit), 1),
            grammar=round(min(10, grammar), 1),
            vocabulary=round(min(10, vocab), 1)
        )

    def determine_confidence(self, features: Dict) -> ScoreConfidence:
        # If total words < 100, confidence is low
        level = "high"
        if features["transcript"]["total_candidate_words"] < 100:
            level = "low"
        elif features["transcript"]["total_candidate_words"] < 300:
            level = "medium"
            
        return ScoreConfidence(
            communication=level,
            confidence=level,
            technical=level,
            role_fit=level,
            grammar=level,
            vocabulary=level
        )

    @staticmethod
    def get_benchmark_label(score: float) -> str:
        if score > 8.5: return "Above Average"
        if score > 6.0: return "Average"
        return "Below Average"
