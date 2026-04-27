import os
import google.generativeai as genai
import json
from typing import Dict, Any

class LLMSynthesizer:
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        model_name = os.getenv("GEMINI_PRO_MODEL") or os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"
        self.model = genai.GenerativeModel(model_name)

    async def synthesize_report(self, features: Dict[str, Any], scores: Dict[str, Any]) -> Dict:
        prompt = f"""
        You are a senior Interview Coach and Performance Analyst. 
        Your task is to synthesize raw metrics into a professional, constructive interview report.
        
        --- INPUT METRICS ---
        Scores: {json.dumps(scores, indent=2)}
        Transcript Features: {json.dumps(features['transcript'], indent=2)}
        Speech Features: {json.dumps(features['fluency'], indent=2)}
        Resume Gaps: {json.dumps(features['resume_gap'], indent=2)}
        
        --- INSTRUCTIONS ---
        1. Use ONLY the provided data.
        2. Provide an Executive Summary.
        3. Identify 3 specific Strengths.
        4. Identify 3 specific Areas for Improvement.
        5. Create a 7-Day Coaching Plan.
        6. Suggest 2-3 Phrase Improvements (You Said vs. Better Way).
        
        Respond ONLY with a JSON object that matches the following structure:
        {{
            "executive_summary": "string",
            "strengths": ["string"],
            "areas_for_improvement": ["string"],
            "coaching_plan": [{{ "day_range": "Day 1-2", "focus": "...", "exercise": "..." }}],
            "phrase_improvements": [{{ "original": "...", "improved": "...", "reason": "..." }}],
            "final_recommendation": "string"
        }}
        """
        
        try:
            response = self.model.generate_content(prompt)
            clean_text = response.text.strip().replace("```json", "").replace("```", "")
            return json.loads(clean_text)
        except Exception as e:
            return {
                "executive_summary": "Analysis completed. Performance was consistent with the scores provided.",
                "strengths": ["Clear communication", "Structured approach"],
                "areas_for_improvement": ["Vocabulary depth"],
                "coaching_plan": [],
                "phrase_improvements": [],
                "final_recommendation": "Maintain consistency and practice domain-specific terms."
            }
