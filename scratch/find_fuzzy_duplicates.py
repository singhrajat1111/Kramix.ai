import json
from difflib import SequenceMatcher

with open(r"d:\Kramix.ai\data\question-bank-data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

similar = []
for i in range(len(data)):
    for j in range(i + 1, len(data)):
        q1 = data[i]
        q2 = data[j]
        ratio = SequenceMatcher(None, q1["question"].lower(), q2["question"].lower()).ratio()
        if ratio > 0.65:
            similar.append((ratio, q1, q2))

similar.sort(key=lambda x: x[0], reverse=True)
print(f"Found {len(similar)} highly similar question pairs:")
for ratio, q1, q2 in similar[:25]:
    id1 = q1.get("question_id") or q1.get("id")
    id2 = q2.get("question_id") or q2.get("id")
    print(f"\nSimilarity: {ratio:.2f}")
    print(f"  [{id1} | {q1['topic']}]: {q1['question']}")
    print(f"  [{id2} | {q2['topic']}]: {q2['question']}")
