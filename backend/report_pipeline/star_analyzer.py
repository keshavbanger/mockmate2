import os
import google.generativeai as genai
import json
from typing import List, Dict
from .models import STARResult

class STARAnalyzer:
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.model = genai.GenerativeModel(model_name)

    async def analyze_answer(self, question: str, answer: str) -> STARResult:
        if not answer.strip():
            return STARResult(situation=False, task=False, action=False, result=False, completeness_score=0)

        prompt = f"""
        Analyze the following interview answer for STAR (Situation, Task, Action, Result) methodology.
        
        Question: {question}
        Answer: {answer}
        
        Respond ONLY with a JSON object in this format:
        {{
            "situation": true/false,
            "task": true/false,
            "action": true/false,
            "result": true/false
        }}
        """
        
        try:
            response = self.model.generate_content(prompt)
            clean_text = response.text.strip().replace("```json", "").replace("```", "")
            data = json.loads(clean_text)
            
            score = sum([1 for v in data.values() if v is True])
            
            return STARResult(
                situation=data.get("situation", False),
                task=data.get("task", False),
                action=data.get("action", False),
                result=data.get("result", False),
                completeness_score=score
            )
        except Exception as e:
            # Fallback to defaults
            return STARResult(situation=False, task=False, action=False, result=False, completeness_score=0)
