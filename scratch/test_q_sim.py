import re
from schemas.question import Question, Difficulty, QuestionType

def make_q(id: str, text: str, concepts: list):
    return Question(
        id=id,
        topic="test",
        difficulty=Difficulty.FOUNDATIONAL,
        question_type=QuestionType.CONCEPTUAL,
        question_text=text,
        expected_concepts=concepts,
        concept_descriptions={c: "desc" for c in concepts},
    )

def is_similar_question(q1: Question, q2: Question) -> bool:
    if q1.id == q2.id:
        return True
    t1 = q1.question_text.lower().strip()
    t2 = q2.question_text.lower().strip()
    if t1 == t2:
        return True
    
    stopwords = {
        "what", "when", "where", "which", "while", "who", "whom", "whose", "why",
        "how", "does", "explain", "describe", "difference", "between", "versus",
        "with", "from", "that", "this", "these", "those", "their", "there", "about",
        "would", "could", "should", "your", "give", "work", "works", "using", "application",
        "applications"
    }
    w1 = {w for w in re.findall(r"\w+", t1) if len(w) > 2 and w not in stopwords}
    w2 = {w for w in re.findall(r"\w+", t2) if len(w) > 2 and w not in stopwords}
    
    # Check concept overlap first
    c1 = {c.lower().strip() for c in q1.expected_concepts}
    c2 = {c.lower().strip() for c in q2.expected_concepts}
    if c1 and c2:
        c_overlap = len(c1 & c2)
        if c_overlap >= 2 or (c_overlap >= 1 and min(len(c1), len(c2)) <= 2):
            return True

    if w1 and w2:
        overlap = len(w1 & w2)
        min_len = min(len(w1), len(w2))
        union_len = len(w1 | w2)
        # Check containment: if one query's keywords are almost entirely inside the other
        if min_len >= 2 and (overlap / min_len) >= 0.75:
            # Check that there isn't a distinguishing keyword like overloading vs overriding
            diff1 = w1 - w2
            diff2 = w2 - w1
            if diff1 and diff2 and len(diff1) == 1 and len(diff2) == 1:
                # E.g. overloading vs overriding
                return False
            return True
        if union_len > 0 and (overlap / union_len) >= 0.65:
            return True

    return False

# Test pairs
q_gil1 = make_q("1", "Explain Python's GIL and its implications.", ["Global Interpreter Lock", "bytecode", "CPU-bound"])
q_gil2 = make_q("2", "Explain Python's Global Interpreter Lock (GIL) and its implications for multi-threaded applications.", ["Global Interpreter Lock", "bytecode", "asyncio"])
print("GIL pair:", is_similar_question(q_gil1, q_gil2))  # Expected True

q_ovl = make_q("3", "What is method overloading in Java?", ["compile-time polymorphism", "same name different params"])
q_ovr = make_q("4", "What is method overriding in Java?", ["runtime polymorphism", "subclass @Override"])
print("Overload vs Override:", is_similar_question(q_ovl, q_ovr))  # Expected False

q_vdom1 = make_q("5", "What is the virtual DOM and why does React use it?", ["virtual DOM", "reconciliation"])
q_vdom2 = make_q("6", "What is the Virtual DOM and how does reconciliation work in React?", ["Virtual DOM", "reconciliation"])
print("VDOM pair:", is_similar_question(q_vdom1, q_vdom2))  # Expected True

q_hooks1 = make_q("7", "What are React hooks, and why were they introduced?", ["functional components", "state in functions"])
q_hooks2 = make_q("8", "What are React Hooks and what rules govern their usage?", ["functional components", "rules of hooks"])
print("Hooks pair:", is_similar_question(q_hooks1, q_hooks2))  # Expected True

q_diff1 = make_q("9", "What is a class and what is an object in Java?", ["class blueprint", "instance"])
q_diff2 = make_q("10", "What is the difference between JDK, JRE, and JVM?", ["JDK", "JRE", "JVM"])
print("Class vs JDK:", is_similar_question(q_diff1, q_diff2))  # Expected False
