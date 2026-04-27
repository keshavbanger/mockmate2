import asyncio
import os
import json
from dotenv import load_dotenv
from report_pipeline import ReportOrchestrator
from report_pipeline.models import (
    Utterance, SpeechMetrics, VisualMetrics, 
    ResumeData, InterviewConfig, QuestionBankItem
)

load_dotenv()

async def test_pipeline():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY not found in .env")
        return

    orchestrator = ReportOrchestrator(api_key)

    # 1. Mock Transcript
    transcript = [
        Utterance(speaker="interviewer", text="Tell me about yourself.", start_time=0, end_time=5, question_id=1),
        Utterance(speaker="candidate", text="I am a senior Java developer with 8 years of experience. I have worked extensively with Spring Boot, Microservices, and Kubernetes. In my last project at TechCorp, I led a team of 5 to migrate our monolith to a distributed architecture which reduced latency by 40%.", start_time=6, end_time=25, question_id=1),
        Utterance(speaker="interviewer", text="How do you handle difficult stakeholders?", start_time=26, end_time=30, question_id=2),
        Utterance(speaker="candidate", text="I believe in clear communication and setting expectations early. Once, I had a stakeholder who wanted to change the project scope mid-sprint. I sat down with them, showed the impact on the timeline using data, and we agreed to move the changes to the next sprint. This kept the team focused and the stakeholder felt heard.", start_time=31, end_time=55, question_id=2),
    ]

    # 2. Mock Speech Metrics
    speech = [
        SpeechMetrics(total_words=45, words_per_minute=140, filler_words_count=2, filler_words_breakdown={"um": 1, "like": 1}, silence_durations=[], avg_pause_duration=0.5, longest_pause=1.2, answer_duration=19),
        SpeechMetrics(total_words=55, words_per_minute=130, filler_words_count=1, filler_words_breakdown={"uh": 1}, silence_durations=[], avg_pause_duration=0.8, longest_pause=1.5, answer_duration=24),
    ]

    # 3. Mock Visual Metrics
    visual = [
        VisualMetrics(dominant_emotion="Confident", emotion_distribution={"Confident": 0.8, "Neutral": 0.2}, eye_contact_score=0.9, head_stability_score=0.95, smile_frequency=0.2, engagement_score=0.9),
        VisualMetrics(dominant_emotion="Focused", emotion_distribution={"Focused": 0.9, "Confident": 0.1}, eye_contact_score=0.85, head_stability_score=0.9, smile_frequency=0.1, engagement_score=0.85),
    ]

    # 4. Mock Resume
    resume = ResumeData(
        candidate_name="Aditi Dhoni",
        target_role="Senior Java Developer",
        years_experience=8,
        skills=["Java", "Spring Boot", "Microservices", "Kubernetes", "AWS", "SQL"],
        projects=[],
        tools=[],
        education=[],
        summary="Experienced backend engineer specializing in high-scale distributed systems."
    )

    # 5. Config
    config = InterviewConfig(interview_type="Technical", difficulty="Hard", selected_language="English", seniority_level="Senior")

    # 6. Questions
    questions = [
        QuestionBankItem(question_id=1, question_text="Tell me about yourself.", category="Introduction", expected_topics=["Experience", "Key Projects"], expected_domain_terms=["Java", "Architecture"], evaluation_focus="Communication"),
        QuestionBankItem(question_id=2, question_text="How do you handle difficult stakeholders?", category="Behavioral", expected_topics=["Conflict Resolution", "Communication"], expected_domain_terms=["Stakeholders", "Impact"], evaluation_focus="Emotional Intelligence"),
    ]

    print("Starting Report Generation Pipeline...")
    start_time = asyncio.get_event_loop().time()
    
    try:
        report = await orchestrator.generate_interview_report(
            transcript, speech, visual, resume, config, questions
        )
        
        end_time = asyncio.get_event_loop().time()
        print(f"Report Generated Successfully in {end_time - start_time:.2f}s")
        
        # Save to file for inspection
        output_path = "sample_report_output.json"
        with open(output_path, "w") as f:
            json.dump(report.dict(), f, indent=2)
        
        print(f"Full JSON report saved to: {output_path}")
        print("\n--- EXECUTIVE SUMMARY ---")
        print(report.executive_summary)
        print("\n--- SCORES ---")
        print(json.dumps(report.score_breakdown.dict(), indent=2))
        
    except Exception as e:
        print(f"Pipeline Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_pipeline())
