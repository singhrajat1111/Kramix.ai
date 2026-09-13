import json
from difflib import SequenceMatcher

with open(r"d:\Kramix.ai\data\question-bank-data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

by_role = {}
for idx, q in enumerate(data):
    role = q.get("role") or q.get("category")
    by_role.setdefault(role, []).append((idx, q))

duplicates_to_replace = []
for role, items in by_role.items():
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            idx1, q1 = items[i]
            idx2, q2 = items[j]
            ratio = SequenceMatcher(None, q1["question"].lower(), q2["question"].lower()).ratio()
            # check key words
            w1 = set(q1["question"].lower().replace("?", "").split())
            w2 = set(q2["question"].lower().replace("?", "").split())
            overlap = len(w1 & w2) / max(1, min(len(w1), len(w2)))
            if ratio > 0.65 or overlap > 0.65:
                duplicates_to_replace.append((role, idx1, q1["question"], idx2, q2["question"], ratio, overlap))

print(f"Total duplicate pairs within same role: {len(duplicates_to_replace)}")
for role, idx1, q1, idx2, q2, r, o in duplicates_to_replace:
    print(f"\n[{role}]")
    print(f"  Item {idx1}: {q1}")
    print(f"  Item {idx2}: {q2}")
    print(f"  (ratio: {r:.2f}, overlap: {o:.2f})")
