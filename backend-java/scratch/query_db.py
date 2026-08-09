import psycopg2
import json

conn = psycopg2.connect(
    dbname="postgres",
    user="postgres",
    password="postgres",
    host="localhost",
    port="5432"
)
cursor = conn.cursor()

# Query latest 5 analyses
cursor.execute("""
    SELECT id, final_score, resume_file_name, verdict, created_at 
    FROM ats_analyses 
    ORDER BY created_at DESC 
    LIMIT 5;
""")
rows = cursor.fetchall()
print("Latest 5 ats_analyses:")
for r in rows:
    print(f"ID: {r[0]} | Score: {r[1]} | File: {r[2]} | Verdict: {r[3]} | Created: {r[4]}")

conn.close()
