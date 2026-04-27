import time
from typing import List, Dict, Any
from .models import Utterance, SpeechMetrics, VisualMetrics, ResumeData, InterviewConfig, QuestionBankItem, ReportOutput
from .feature_extractor import FeatureExtractor
from .star_analyzer import STARAnalyzer
from .resume_gap_analyzer import ResumeGapAnalyzer
from .scoring import ScoringEngine
from .llm_synthesizer import LLMSynthesizer

class ReportOrchestrator:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.star_analyzer = STARAnalyzer(api_key)
        self.llm = LLMSynthesizer(api_key)
        self.scoring = ScoringEngine()

    async def generate_interview_report(
        self,
        transcript_data: List[Utterance],
        speech_metrics: List[SpeechMetrics],
        visual_metrics: List[VisualMetrics],
        resume_data: ResumeData,
        interview_config: InterviewConfig,
        question_bank: List[QuestionBankItem]
    ) -> ReportOutput:
        
        # 1. Feature Extraction (Deterministic)
        transcript_feats = FeatureExtractor.compute_transcript_features(transcript_data)
        fluency_feats = FeatureExtractor.compute_fluency_features(speech_metrics)
        pace_stability = FeatureExtractor.compute_pace_stability(speech_metrics)
        
        # Visual averaging
        avg_eye = sum(v.eye_contact_score for v in visual_metrics) / len(visual_metrics) if visual_metrics else 0
        visual_feats = {
            "avg_eye_contact_score": round(avg_eye, 2),
            "dominant_emotion": visual_metrics[-1].dominant_emotion if visual_metrics else "Neutral"
        }
        
        # 2. Specialized Analysis (Semantic but structured)
        resume_gaps = ResumeGapAnalyzer.analyze_gaps(resume_data, transcript_feats["full_candidate_transcript"])
        
        # STAR Analysis per question
        question_results = []
        total_star_score = 0
        
        for q in question_bank:
            # Find candidate answer for this q
            ans_utterances = [u.text for u in transcript_data if u.speaker == "candidate" and u.question_id == q.question_id]
            full_ans = " ".join(ans_utterances)
            
            star_res = await self.star_analyzer.analyze_answer(q.question_text, full_ans)
            total_star_score += star_res.completeness_score
            
            # Find matching speech metrics
            # (In production, you'd match by index or ID)
            
            question_results.append({
                "question_id": q.question_id,
                "question_text": q.question_text,
                "transcript": full_ans,
                "star": star_res.dict(),
                "status": "Strong" if star_res.completeness_score >= 3 else "Needs Focus"
            })
            
        avg_star = total_star_score / len(question_bank) if question_bank else 0
        
        # 3. Deterministic Scoring
        all_features = {
            "transcript": transcript_feats,
            "fluency": fluency_feats,
            "pace_stability": pace_stability,
            "visual": visual_feats,
            "resume_gap": resume_gaps,
            "avg_star_score": avg_star
        }
        
        final_scores = self.scoring.compute_all_scores(all_features)
        confidence = self.scoring.determine_confidence(all_features)
        overall = sum(final_scores.dict().values()) / 6
        
        # 4. LLM Synthesis
        synthesis = await self.llm.synthesize_report(all_features, final_scores.dict())
        
        # 5. Assemble Final Report
        return ReportOutput(
            candidate={
                "name": resume_data.candidate_name,
                "role": resume_data.target_role,
                "date": time.strftime("%b %d, %Y"),
                "duration_minutes": sum(m.answer_duration for m in speech_metrics) / 60
            },
            overall_score=int(overall * 10), # Scale to 100
            benchmark_label=ScoringEngine.get_benchmark_label(overall),
            score_breakdown=final_scores,
            score_confidence=confidence,
            speech_summary={
                "total_words": transcript_feats["total_candidate_words"],
                "avg_wpm": fluency_feats["avg_wpm"],
                "filler_words_total": fluency_feats["total_fillers"]
            },
            visual_summary={
                "dominant_emotion": visual_feats["dominant_emotion"],
                "avg_eye_contact_score": visual_feats["avg_eye_contact_score"]
            },
            grammar_analysis={
                "error_count": 0, # Placeholder
                "corrections": []
            },
            vocabulary_analysis={
                "type_token_ratio": transcript_feats["type_token_ratio"],
                "domain_terms_used": resume_gaps["mentioned_skills"],
                "missing_domain_terms": resume_gaps["unmentioned_skills"],
                "richness_score": int(transcript_feats["type_token_ratio"] * 100)
            },
            resume_gap_analysis=resume_gaps,
            questions=question_results,
            **synthesis # Unpack summary, strengths, weaknesses, plan, etc.
        )
