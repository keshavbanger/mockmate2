import math
from typing import List, Dict
from .models import Utterance, SpeechMetrics

class FeatureExtractor:
    @staticmethod
    def compute_transcript_features(utterances: List[Utterance]) -> Dict:
        candidate_text = " ".join([u.text for u in utterances if u.speaker == "candidate"])
        candidate_words = candidate_text.split()
        
        # Type-Token Ratio (Vocabulary Richness)
        unique_words = set(candidate_words)
        ttr = len(unique_words) / len(candidate_words) if candidate_words else 0
        
        return {
            "total_candidate_words": len(candidate_words),
            "unique_words_count": len(unique_words),
            "type_token_ratio": round(ttr, 3),
            "full_candidate_transcript": candidate_text
        }

    @staticmethod
    def compute_fluency_features(metrics: List[SpeechMetrics]) -> Dict:
        if not metrics:
            return {"avg_wpm": 0, "filler_ratio": 0}
            
        total_words = sum(m.total_words for m in metrics)
        total_fillers = sum(m.filler_words_count for m in metrics)
        avg_wpm = sum(m.words_per_minute for m in metrics) / len(metrics)
        
        filler_ratio = total_fillers / total_words if total_words > 0 else 0
        
        return {
            "avg_wpm": round(avg_wpm, 1),
            "total_fillers": total_fillers,
            "filler_ratio": round(filler_ratio, 3),
            "fluency_score": max(0, min(10, 10 - (filler_ratio * 100))) # Deduct for fillers
        }

    @staticmethod
    def compute_pace_stability(metrics: List[SpeechMetrics]) -> float:
        if len(metrics) < 2:
            return 1.0 # Stable
        
        wpms = [m.words_per_minute for m in metrics]
        mean_wpm = sum(wpms) / len(wpms)
        variance = sum((x - mean_wpm) ** 2 for x in wpms) / len(wpms)
        std_dev = math.sqrt(variance)
        
        # Lower std_dev means higher stability
        stability = max(0, 1 - (std_dev / mean_wpm)) if mean_wpm > 0 else 0
        return round(stability, 2)
