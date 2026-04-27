export const reportData = {
  candidate: { 
    name: "Aditi Dhoni", 
    role: "Senior Java Developer", 
    date: "Apr 27, 2026", 
    duration: "28 min",
    interviewType: "Technical Round"
  },
  overallScore: 72,
  scores: {
    communication: 7, 
    confidence: 8, 
    technical: 6,
    roleFit: 8, 
    grammar: 6, 
    vocabulary: 7, 
    eyeContact: 5
  },
  facialAnalysis: {
    dominantEmotion: "Confident",
    eyeContactPercent: 78,
    emotionDistribution: { neutral: 65, nervous: 15, confident: 15, focused: 5 }
  },
  confidenceTrend: [4, 6, 8, 7, 9, 8, 9], // per question
  grammarAnalysis: {
    score: 82, 
    errors: 12, 
    tenseIssues: 5, 
    complexity: 78,
    corrections: [
      {
        timestamp: "0:05",
        original: "I don't have a question but can you call me to now with the next one",
        corrected: "I am not prepared to answer this question. Could we please move on to the next one?",
        rule: "Formal Register and Clarity"
      },
      {
        timestamp: "2:15",
        original: "Java is more faster than Python in some cases",
        corrected: "Java is faster than Python in some cases",
        rule: "Comparative Adjectives"
      }
    ]
  },
  vocabulary: {
    richnessScore: 68, 
    totalWords: 1450,
    domainTermsUsed: ["JVM", "Inheritance", "Polymorphism", "Garbage Collection"],
    missingDomainTerms: ["interface", "abstract class", "dependency injection", "restful api", "docker", "serverless", "singleton", "synchronized", "volatile", "microservices"]
  },
  answers: [
    {
      id: 1, 
      status: "NEEDS FOCUS", 
      score: 4,
      question: "Can you explain the difference between an interface and an abstract class in Java?",
      duration: 45, 
      wpm: 110, 
      emotion: "nervous", 
      fillerCount: 5,
      star: { situation: true, task: true, action: false, result: false },
      analysis: "The candidate understood the core concept but failed to explain the practical use cases and modern Java 8+ changes.",
      transcript: "Well, interfaces are like a contract and abstract classes are... uh... they can have methods implemented. But I didn't use them much lately."
    },
    {
      id: 2, 
      status: "BEST ANSWER", 
      score: 9,
      question: "How do you handle multithreading in a high-concurrency environment?",
      duration: 120, 
      wpm: 135, 
      emotion: "confident", 
      fillerCount: 1,
      star: { situation: true, task: true, action: true, result: true },
      analysis: "Excellent breakdown of the ExecutorService, CompletableFuture, and race condition mitigation strategies.",
      transcript: "In my last project at TechCorp, we faced a bottleneck in our order processing system. I implemented a thread pool using FixedThreadPool and used ConcurrentHashMap to ensure thread safety without heavy locking..."
    }
  ],
  fillerWords: { um: 12, uh: 8, like: 15, basically: 4, "you know": 6 },
  coaching: {
    cefrLevel: "B2",
    strengths: ["Strong technical core", "Good situational awareness", "Clear voice modulation"],
    weaknesses: ["Occasional filler word usage", "Weak coverage of architectural patterns", "Informal register in technical explanations"],
    weekPlan: [
      { day: "Day 1-2", task: "Practice answering STAR-method technical questions", icon: "⭐" },
      { day: "Day 3-4", task: "Filler word reduction — 10-minute daily recording drill", icon: "🎙️" },
      { day: "Day 5-6", task: "Study 10 missing domain terms with example sentences", icon: "📚" },
      { day: "Day 7",   task: "Re-attempt Q1, Q3, Q5 cold — record and self-review", icon: "🔄" }
    ]
  },
  resumeGaps: [
    { skill: "Kubernetes", mentioned: "Never", depth: "—", recommendation: "Prepare a 60-second Kubernetes story using STAR" },
    { skill: "Java Spring Boot", mentioned: "Briefly", depth: "Shallow", recommendation: "Practice deeper architectural discussion" },
    { skill: "REST API Design", mentioned: "3 times", depth: "Strong", recommendation: "Keep it up ✓" }
  ]
};
