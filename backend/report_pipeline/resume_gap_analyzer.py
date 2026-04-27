from typing import List, Dict
from .models import ResumeData

class ResumeGapAnalyzer:
    @staticmethod
    def analyze_gaps(resume: ResumeData, full_transcript: str) -> Dict:
        transcript_lower = full_transcript.lower()
        
        mentioned = []
        unmentioned = []
        
        for skill in resume.skills:
            if skill.lower() in transcript_lower:
                mentioned.append(skill)
            else:
                unmentioned.append(skill)
        
        # Simple heuristic: if mentioned but count is 1, it's "shallow"
        shallow = []
        strong = []
        
        for skill in mentioned:
            count = transcript_lower.count(skill.lower())
            if count == 1:
                shallow.append(skill)
            else:
                strong.append(skill)
                
        return {
            "mentioned_skills": mentioned,
            "unmentioned_skills": unmentioned,
            "shallow_skills": shallow,
            "strong_skills": strong,
            "gap_score": len(mentioned) / len(resume.skills) if resume.skills else 0
        }
