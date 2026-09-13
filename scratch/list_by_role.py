import json

with open(r"d:\Kramix.ai\data\question-bank-data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

by_role = {}
for q in data:
    role = q.get("role") or q.get("category")
    by_role.setdefault(role, []).append(q)

for role, qlist in by_role.items():
    print(f"\nRole: {role} ({len(qlist)} questions)")
    for i, q in enumerate(qlist):
        print(f"  {i+1}: {q['question']}")
