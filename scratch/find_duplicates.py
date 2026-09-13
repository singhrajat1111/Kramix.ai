import json

with open(r"d:\Kramix.ai\data\question-bank-data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Total questions in bank: {len(data)}")

texts = {}
for q in data:
    txt = q["question"].strip().lower()
    # normalize punctuation
    txt_norm = "".join(c for c in txt if c.isalnum() or c.isspace()).strip()
    if txt_norm in texts:
        print(f"DUPLICATE FOUND:")
        print(f"  1: {texts[txt_norm]['id']} [{texts[txt_norm]['topic']}] -> {texts[txt_norm]['question']}")
        print(f"  2: {q['id']} [{q['topic']}] -> {q['question']}")
    else:
        texts[txt_norm] = q
