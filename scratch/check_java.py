import json

with open(r"d:\Kramix.ai\data\question-bank-data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for q in data:
    role = q.get("role") or q.get("category")
    if "Java" in role or "Spring" in role:
        print(f"[{role}] {q['question']}")
