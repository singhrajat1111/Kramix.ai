import json
from collections import Counter

with open(r"d:\Kramix.ai\data\question-bank-data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

topics = Counter()
for q in data:
    t = q.get("role") or q.get("category") or "general"
    topics[t] += 1

print("Questions per topic/role:")
for t, c in topics.most_common():
    print(f"  {t}: {c}")
