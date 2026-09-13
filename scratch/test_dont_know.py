import sys
import os
sys.path.insert(0, r"d:\Kramix.ai")

from backend.app.session_store import global_session_store
from backend.app.schemas_api import CreateSessionRequest

for role in ["core java", "python developer"]:
    print(f"\n================ ROLE: {role} (I DON'T KNOW) ================")
    req = CreateSessionRequest(mode="demo", role=role, max_turns=6)
    active = global_session_store.create_session(req)
    runner = active.runner
    
    q = runner.start()
    print(f"Turn 1: {q.id} -> {q.question_text[:60]}")
    
    for turn in range(1, 10):
        if runner.is_complete:
            print(f"Completed after {len(runner.state.question_history)} questions.")
            break
        res = runner.submit_answer("I don't know.")
        print(f"Turn {turn} verdict: is_dont_know={res.verdict.is_dont_know if res.verdict else False}, action={res.decision.action if res.decision else None}")
        if res.next_question:
            print(f"Turn {runner.state.current_turn}: {res.next_question.id} -> {res.next_question.question_text[:60]}")
        else:
            print(f"Turn {runner.state.current_turn}: Completed. No next question.")
            
    history = [q.question_id for q in runner.state.question_history]
    duplicates = [qid for qid in history if history.count(qid) > 1]
    if duplicates:
        print(f"!!! DUPLICATES DETECTED: {set(duplicates)}")
    else:
        print(f"All {len(history)} questions were unique.")
