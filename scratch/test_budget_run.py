import sys
import os
sys.path.insert(0, r"d:\Kramix.ai")

from backend.app.session_store import global_session_store
from backend.app.schemas_api import CreateSessionRequest
from schemas.interview_state import InterviewPhase

def simulate():
    req = CreateSessionRequest(mode="demo", role="core java", max_turns=6)
    active = global_session_store.create_session(req)
    runner = active.runner
    
    print(f"Session created: max_turns={runner.max_turns}")
    q1 = runner.start()
    print(f"Turn {runner.state.current_turn}: {q1.id} -> {q1.question_text[:60]}")
    
    for turn in range(1, 10):
        if runner.is_complete:
            print(f"Runner is complete at turn {runner.state.current_turn}!")
            break
        res = runner.submit_answer("In Java, memory is managed by JVM garbage collection using heap and stack.")
        print(f"Submitted turn {turn}. Result is_complete={res.is_complete}, phase={runner.current_phase}")
        if res.next_question:
            print(f"Turn {runner.state.current_turn}: Next question: {res.next_question.id} -> {res.next_question.question_text[:60]}")
        else:
            print(f"Turn {runner.state.current_turn}: Next question is None")

    print("\nQuestion history:")
    for i, q in enumerate(runner.state.question_history):
        print(f"{i+1}: {q.question_id} - {q.question_text[:60]}")

simulate()
