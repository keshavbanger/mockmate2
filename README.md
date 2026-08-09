# 🎙️ MockMate AI — Advanced Technical & DSA AI Interview Platform

MockMate AI is an enterprise-grade, interactive AI technical interview platform designed to simulate realistic coding assessments, system design interviews, and technical behavioral evaluations. Powered by a **Spring Boot 3** Java backend, **Groq Llama 3.3 70B / Gemini** LLM orchestration, and a **React 18 + Monaco Editor** frontend, MockMate delivers real-time DSA code execution via an in-memory Reflection sandbox, SQL evaluation, and multi-round adaptive interviews.

---

## ✨ Key Features

- **⚡ Fast-Track DSA Compiler Mode** — Option to skip introductory dialogue and jump immediately into live, hands-on DSA coding questions (e.g. *Two Sum*, *Reverse Linked List*, etc.) with pre-configured problem descriptions and starter boilerplate.
- **💻 Java Reflection & Sandbox Compiler** — Safe, in-memory compilation and dynamic reflection execution of candidate code submissions against multi-case unit testing harnesses.
- **🎯 Dynamic Interview Plan Generator** — Tailors multi-round plans (Intro, DSA, System Design, General Technical, SQL) based on role level, company style, target tech stack, and duration.
- **🤖 Adaptive AI Interviewer Engine** — Groq-powered multi-turn dialogue with turn validation, anti-scolding guardrails, essay-length response truncation, and single-sentence DSA hints.
- **📊 Real-time Execution Feedback & Scoring** — Instant evaluation of test case pass rates, time/space complexity analysis, and adaptive difficulty escalation.
- **📝 Comprehensive Report Generation** — Automatic generation of detailed performance breakdowns, code quality reviews, running average trend analysis, and printable PDF/Markdown scorecards.

---

## 🛠️ Technology Stack

### Backend (`backend-java`)
- **Framework**: Java 17, Spring Boot 3.4.1, Spring Security (JWT Authentication), Spring Data JPA
- **Database**: H2 (In-memory development) / PostgreSQL ready
- **LLM Integration**: Groq API (Llama 3.3 70B Versatile, JSON Mode), Jackson ObjectMapper
- **Execution Engine**: Java Reflection API + In-Memory Dynamic Compiler (`javax.tools.JavaCompiler`)
- **Build System**: Apache Maven 3.9+ (`mvnw.cmd`)

### Frontend (`frontend`)
- **Framework**: React 18, Vite
- **Code Editor**: `@monaco-editor/react` (Monaco Editor with syntax highlighting & dark mode)
- **Layout & Styling**: `react-split` (resizable split-pane interface), Lucide React Icons, Vanilla CSS Design System
- **State Management & Routing**: React Context API, `react-router-dom` v6

---

## 🚀 Quick Start Guide

### Prerequisites
- **Java**: OpenJDK 17 or higher
- **Node.js**: 18+ (LTS) & `npm` 9+
- **API Keys**: Groq API Key (get key at [Groq Console](https://console.groq.com/))

---

### Step 1 — Configure Environment Variables

#### Backend Configuration
Create or edit `backend-java/src/main/resources/application.properties` (or set environment variables):
```properties
server.port=8080
groq.api.key=YOUR_GROQ_API_KEY
groq.model=llama-3.3-70b-versatile
```

---

### Step 2 — Start the Backend (Spring Boot)

```bash
cd backend-java

# On Windows (PowerShell/CMD):
.\mvnw.cmd spring-boot:run

# On Linux/macOS:
./mvnw spring-boot:run
```

The Spring Boot backend will start on **`http://localhost:8080`**.

---

### Step 3 — Start the Frontend (React + Vite)

In a separate terminal tab/window:
```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The React frontend will start on **`http://localhost:5173`** (with automatic API proxying to `http://localhost:8080`).

---

## 🎮 How to Use

1. **Setup Page (`/tech-setup`)**:
   - Choose Role Level (e.g., *Senior Software Engineer*), Company Style (*FAANG / Big Tech*), and Focus Areas (*DSA, System Design, Concurrency*).
   - **⚡ Fast-Track Mode**: Check **"Direct to DSA Coding Assessment"** if you want to skip introductory greetings and jump straight into solving coding problems.
   - Click **Generate Custom Plan & Launch**.

2. **Interview Room (`/tech-interview/:sessionId`)**:
   - Interact with the AI Interviewer via chat or speech.
   - For DSA rounds, the split-pane editor will auto-launch with problem specifications, boilerplate code, and custom test-runner controls (**Run** and **Submit**).
   - Real-time compiler output displays test results, runtime exceptions, or detailed test case pass counts.

3. **Report Page (`/tech-report/:sessionId`)**:
   - View your overall score, detailed round breakdown, complexity feedback, and download your final PDF/Markdown performance report.

---

## 🗺️ Project Architecture

```
USER BROWSER (http://localhost:5173)
 ┌───────────────────────────────────────────────────────────────┐
 │  TechInterviewSetupPage.jsx                                   │
 │   ├─ Config selection (Role, Style, Duration, Fast-Track)    │
 │   └─ POST /api/tech-interview/plan (Generate Plan)           │
 │                                                               │
 │  TechInterviewPage.jsx (Split Pane Interface)                  │
 │   ├─ AI Chat Window (Multi-turn guidance, short hints)       │
 │   └─ Code Editor (Monaco Editor + Java / SQL execution controls)│
 └──────────────────────────────┬────────────────────────────────┘
                                │ API proxy (/api/* → localhost:8080)
                                ▼
 SPRING BOOT BACKEND (http://localhost:8080)
 ┌───────────────────────────────────────────────────────────────┐
 │  TechnicalInterviewController                                 │
 │   ├─ POST /plan               → AIInterviewerService (Plan)   │
 │   ├─ POST /start              → TechInterviewStateService     │
 │   ├─ POST /{sessionId}/answer → Code execution & AI Turn      │
 │   └─ POST /{sessionId}/execute-code → Reflection Test Runner │
 │                                                               │
 │  Services:                                                    │
 │   ├─ CodeExecutionService     (In-Memory Java Compiler + Refl)│
 │   ├─ AIInterviewerService     (Groq Llama 3.3 70B JSON mode) │
 │   └─ SQLExecutionService      (In-memory SQL Sandbox)         │
 └───────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
keiyeta 2/
├── backend-java/                  # Spring Boot 3 Backend
│   ├── src/main/java/com/example/mockmate/
│   │   ├── controller/            # REST API Endpoints (TechnicalInterviewController, Auth, etc.)
│   │   ├── model/techinterview/   # Plan, Session, Turn, and DSA Attempt Data Models
│   │   ├── service/               # AIInterviewerService, CodeExecutionService, StateService
│   │   └── config/                # Security & CORS Configurations
│   ├── pom.xml                    # Maven Dependencies & Build Setup
│   └── mvnw.cmd / mvnw            # Maven Wrapper Executables
│
└── frontend/                      # React 18 + Vite Frontend
    ├── src/
    │   ├── pages/                 # TechInterviewSetupPage, TechInterviewPage, TechReportPage
    │   ├── components/            # Split Editor, Code execution panel, Chat UI
    │   └── utils/                 # API client utilities
    ├── package.json
    └── vite.config.js
```

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.
