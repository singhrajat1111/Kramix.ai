import re
from difflib import SequenceMatcher

STOPWORDS = {
    "what", "when", "where", "which", "while", "who", "whom", "whose", "why",
    "how", "does", "explain", "describe", "difference", "between", "versus",
    "with", "from", "that", "this", "these", "those", "their", "there", "about",
    "would", "could", "should", "your", "give", "work", "works", "using"
}

def are_questions_similar(q1_text: str, q2_text: str) -> bool:
    t1 = q1_text.lower().strip()
    t2 = q2_text.lower().strip()
    if t1 == t2:
        return True
    
    words1 = {w for w in re.findall(r"\w+", t1) if len(w) > 2 and w not in STOPWORDS}
    words2 = {w for w in re.findall(r"\w+", t2) if len(w) > 2 and w not in STOPWORDS}
    
    if not words1 or not words2:
        return False
        
    overlap = len(words1 & words2)
    jaccard = overlap / len(words1 | words2)
    seq_ratio = SequenceMatcher(None, t1, t2).ratio()
    
    return jaccard >= 0.50 or seq_ratio >= 0.72

test_pairs = [
    ("Explain Python's GIL and its implications.", "Explain Python's Global Interpreter Lock (GIL) and its implications for multi-threaded applications.", True),
    ("What are decorators and give a practical use case.", "What are Python decorators and how do they work under the hood?", True),
    ("What is the virtual DOM and why does React use it?", "What is the Virtual DOM and how does reconciliation work in React?", True),
    ("What is method overloading in Java?", "What is method overriding in Java?", False),
    ("What is a class and what is an object in Java?", "What is the difference between JDK, JRE, and JVM?", False),
    ("What is the difference between an interface and an abstract class?", "What is the difference between == and .equals() in Java?", False),
    ("What is Jetpack Compose and how does it differ from XML layouts?", "What is Jetpack Compose and how does it differ from the traditional View system?", True),
]

for q1, q2, expected in test_pairs:
    res = are_questions_similar(q1, q2)
    status = "PASS" if res == expected else f"FAIL (got {res}, expected {expected})"
    print(f"[{status}] '{q1[:40]}' vs '{q2[:40]}'")
