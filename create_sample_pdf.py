"""
Create a sample resume PDF for testing.
Run: python create_sample_pdf.py
"""
import fitz  # PyMuPDF

def create_resume():
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # A4

    # We'll use basic text insertion via page.insert_text
    y = 72
    def line(text, size=10, bold=False, gap=18):
        nonlocal y
        page.insert_text(
            (72, y),
            text,
            fontname="Helvetica-Bold" if bold else "Helvetica",
            fontsize=size,
            color=(0, 0, 0),
        )
        y += gap

    line("John Doe", size=20, bold=True, gap=24)
    line("john.doe@example.com  |  +91 98765 43210  |  linkedin.com/in/johndoe", size=9, gap=20)
    line("─" * 90, size=7, gap=16)

    line("PROFESSIONAL SUMMARY", size=12, bold=True, gap=16)
    line("Senior Software Engineer with 4 years of experience building scalable REST APIs,", size=9, gap=14)
    line("full-stack web applications, and ML pipelines. Passionate about clean code and DevOps.", size=9, gap=22)

    line("TECHNICAL SKILLS", size=12, bold=True, gap=16)
    line("Languages:   Python, JavaScript, TypeScript, SQL", size=9, gap=14)
    line("Frameworks:  FastAPI, React, Node.js, Next.js, PyTorch", size=9, gap=14)
    line("Infrastructure: Docker, Kubernetes, AWS (EC2, S3, Lambda), PostgreSQL, Redis", size=9, gap=22)

    line("WORK EXPERIENCE", size=12, bold=True, gap=16)
    line("Senior Software Engineer  —  Acme Technologies Pvt. Ltd.        2022 – 2024", size=10, bold=True, gap=14)
    line("  • Architected REST APIs serving 500k+ daily requests (FastAPI + PostgreSQL)", size=9, gap=12)
    line("  • Deployed ML inference pipelines on AWS, reducing response latency by 60%", size=9, gap=12)
    line("  • Led team of 4 engineers; introduced CI/CD with GitHub Actions + Docker", size=9, gap=18)
    line("Full Stack Developer  —  TechStartup India Pvt. Ltd.             2021 – 2022", size=10, bold=True, gap=14)
    line("  • Built React.js dashboards and Node.js microservices for 10k+ active users", size=9, gap=12)
    line("  • Integrated Stripe payment gateway and real-time WebSocket notifications", size=9, gap=22)

    line("EDUCATION", size=12, bold=True, gap=16)
    line("B.Tech — Computer Science & Engineering  |  IIT Delhi  |  2021  |  CGPA: 8.7/10", size=9, gap=22)

    line("PROJECTS", size=12, bold=True, gap=16)
    line("AI Interview Coach  —  FastAPI · Gemini · Tavus CVI · MediaPipe · React", size=9, bold=True, gap=13)
    line("  End-to-end mock interview platform with facial emotion analysis and AI feedback", size=9, gap=14)
    line("ML Trading Bot  —  Python · PyTorch · Alpaca API", size=9, bold=True, gap=13)
    line("  Trained LSTM model for short-term price prediction; 18% annualised return", size=9, gap=14)

    doc.save("test-assets/sample-resume.pdf")
    print("✅ test-assets/sample-resume.pdf created successfully!")
    print(f"   Pages: {len(doc)}")

if __name__ == "__main__":
    import pathlib
    pathlib.Path("test-assets").mkdir(exist_ok=True)
    create_resume()
