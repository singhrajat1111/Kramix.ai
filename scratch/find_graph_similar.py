import sys
sys.path.insert(0, r"d:\Kramix.ai")
from difflib import SequenceMatcher
from question_engine.loader import load_question_bank_from_json

graph = load_question_bank_from_json(r"d:\Kramix.ai\data\question-bank-data.json")
all_q = graph.get_all_questions()
print(f"Total graph questions: {len(all_q)}")

similar = []
for i in range(len(all_q)):
    for j in range(i + 1, len(all_q)):
        q1 = all_q[i]
        q2 = all_q[j]
        ratio = SequenceMatcher(None, q1.question_text.lower(), q2.question_text.lower()).ratio()
        if ratio > 0.65:
            similar.append((ratio, q1, q2))

similar.sort(key=lambda x: x[0], reverse=True)
print(f"Found {len(similar)} similar question pairs:")
for ratio, q1, q2 in similar[:40]:
    print(f"\nSimilarity: {ratio:.2f}")
    print(f"  [{q1.id} | {q1.topic}]: {q1.question_text}")
    print(f"  [{q2.id} | {q2.topic}]: {q2.question_text}")
