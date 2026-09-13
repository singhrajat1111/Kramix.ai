import json
from difflib import SequenceMatcher

with open(r"d:\Kramix.ai\data\question-bank-data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

from scratch.apply_replacements import replacements

found = set()
for q in data:
    if q["question"].strip() in replacements:
        found.add(q["question"].strip())

missing = set(replacements.keys()) - found
print(f"Missing ({len(missing)}):")
for m in missing:
    print(f"  Target: {m}")
    # find best match in data
    best = max(data, key=lambda q: SequenceMatcher(None, q["question"], m).ratio())
    print(f"  Closest in data: {best['question']} (ratio: {SequenceMatcher(None, best['question'], m).ratio():.2f})")
