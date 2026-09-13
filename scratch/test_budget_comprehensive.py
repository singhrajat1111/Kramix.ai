import sys
import os
sys.path.insert(0, r"d:\Kramix.ai")

from backend.app.session_store import SessionStore
from backend.app.schemas_api import CreateSessionRequest

store = SessionStore()

roles_and_budgets = [
    ("python developer", 4),
    ("python developer", 6),
    ("python developer", 8),
    ("frontend developer (react)", 6),
    ("frontend developer (react)", 8),
    (".net developer (c#)", 6),
    (".net developer (c#)", 8),
    ("site reliability engineer (sre)", 6),
    ("core java", 6),
    ("core java", 8),
]

all_passed = True

for role, budget in roles_and_budgets:
    req = CreateSessionRequest(mode="demo", role=role, max_turns=budget)
    active = store.create_session(req)
    runner = active.runner

    q = runner.start()
    asked = [q]

    for turn in range(1, budget + 3):
        if runner.is_complete:
            break
        res = runner.submit_answer(f"Answer for turn {turn} discussing core principles and tradeoffs.")
        if res.next_question:
            asked.append(res.next_question)

    history_ids = [q.id for q in asked]
    history_texts = [q.question_text for q in asked]
    
    # Check for identical IDs
    has_dup_id = len(history_ids) != len(set(history_ids))
    # Check for identical or twin texts
    has_dup_text = False
    for i in range(len(asked)):
        for j in range(i + 1, len(asked)):
            if runner.question_graph._is_duplicate_or_similar(asked[i], {asked[j].id}):
                print(f"FAILED: Twin questions detected in {role} ({budget} Qs):")
                print(f"  Q1: {asked[i].question_text}")
                print(f"  Q2: {asked[j].question_text}")
                has_dup_text = True
                all_passed = False

    turns_asked = len(runner.state.question_history)
    status = "OK" if not has_dup_id and not has_dup_text and turns_asked == budget else "FAIL"
    if status == "FAIL":
        all_passed = False
    print(f"[{status}] Role: {role:<32} Budget: {budget} | Asked: {turns_asked} Qs | is_complete: {runner.is_complete}")

if all_passed:
    print("\nALL BUDGET & UNIQUENESS CHECKS PASSED!")
else:
    print("\nSOME CHECKS FAILED!")
    sys.exit(1)
