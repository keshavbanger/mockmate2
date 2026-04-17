import os, fitz, pathlib
p = pathlib.Path("test-assets/sample-resume.pdf")
if p.exists():
    doc = fitz.open(str(p))
    text = doc[0].get_text()
    print("PDF OK - Pages:", len(doc), "- Text chars:", len(text))
    print("First 200 chars:", text[:200])
else:
    print("PDF MISSING - recreating...")
    pathlib.Path("test-assets").mkdir(exist_ok=True)
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    content = """John Doe
john.doe@example.com | +91 98765 43210

SUMMARY
Senior Software Engineer with 4 years of experience building scalable REST APIs,
full-stack web applications, and ML pipelines.

SKILLS
Python, FastAPI, React, TypeScript, Docker, AWS, PostgreSQL, Redis, PyTorch, Node.js

WORK EXPERIENCE
Senior Software Engineer - Acme Technologies (2022-2024)
- Architected REST APIs serving 500k+ daily requests
- Deployed ML inference pipelines reducing latency by 60%

Full Stack Developer - TechStartup India (2021-2022)
- Built React dashboards for 10k+ active users

EDUCATION
B.Tech Computer Science - IIT Delhi (2021) CGPA 8.7
"""
    page.insert_text((72, 72), content, fontname="Helvetica", fontsize=10)
    doc.save("test-assets/sample-resume.pdf")
    print("PDF created -", len(doc), "page(s)")
