import json

with open(r"d:\Kramix.ai\data\question-bank-data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

second_replacements = {
    "Explain the RAG (Retrieval-Augmented Generation) architecture and when you'd use it over fine-tuning.": {
        "question": "How do vector databases perform approximate nearest neighbor (ANN) search? Compare HNSW vs IVFFlat algorithms.",
        "keyPoints": [
            "graph-based HNSW for high recall and fast queries",
            "inverted file index IVFFlat with Voronoi cells",
            "indexing time vs memory consumption trade-offs",
            "cosine similarity vs dot product metrics"
        ]
    },
    "What are the key strategies for reducing hallucination in LLM applications?": {
        "question": "Explain the function calling and tool-use mechanics in modern LLMs. How do structured schemas guide generation?",
        "keyPoints": [
            "JSON schema specification in system prompt / API",
            "constrained decoding and grammar-based sampling",
            "multi-turn tool execution loop",
            "error handling and tool retry patterns"
        ]
    },
    "How do you evaluate the quality of an LLM's outputs in production?": {
        "question": "What are LLM evaluation benchmarks (like MMLU, GSM8k) and how do you use LLM-as-a-judge for domain tasks?",
        "keyPoints": [
            "automated benchmark datasets for general reasoning",
            "LLM-as-a-judge rubric and pairwise ranking",
            "positional bias and self-preference mitigation",
            "human correlation metrics"
        ]
    },
    "Explain the bias-variance tradeoff and how it affects model selection.": {
        "question": "What is gradient descent and how do Adam and RMSprop optimizers improve convergence over standard SGD?",
        "keyPoints": [
            "SGD with momentum accelerates in persistent directions",
            "RMSprop divides learning rate by running average of squared gradients",
            "Adam combines momentum and adaptive learning rates",
            "learning rate scheduling and warmup"
        ]
    },
    "How do you handle class imbalance in a classification problem?": {
        "question": "Explain regularization techniques in deep learning: L1/L2, Dropout, and Batch Normalization.",
        "keyPoints": [
            "L1 promotes sparsity (Lasso), L2 penalizes large weights (Ridge/weight decay)",
            "Dropout randomly zeroes activations during training to prevent co-adaptation",
            "BatchNorm stabilizes internal covariate shift across mini-batches",
            "inference vs training behavior in Dropout and BatchNorm"
        ]
    },
    "How would you deploy an ML model to production? Describe the end-to-end pipeline.": {
        "question": "What is model drift (concept drift vs data drift) and how do you detect and mitigate it in production?",
        "keyPoints": [
            "data drift changes input distribution P(X)",
            "concept drift changes mapping P(Y|X)",
            "statistical distance tests (KS test, PSI, Wasserstein distance)",
            "continuous retraining pipelines and shadow deployments"
        ]
    },
    "How do you handle missing data in a dataset?": {
        "question": "Explain ROC-AUC and PR-AUC. When should you prioritize PR-AUC over ROC-AUC?",
        "keyPoints": [
            "ROC curve plots TPR vs FPR across thresholds",
            "PR curve plots Precision vs Recall",
            "ROC-AUC can be misleadingly optimistic on heavily imbalanced datasets",
            "PR-AUC provides more informative evaluation when positive class is rare"
        ]
    },
    "How would you investigate a sudden drop in a key business metric?": {
        "question": "How do you design a cohort retention analysis? What metrics and visualizations do you provide to product teams?",
        "keyPoints": [
            "defining cohort groups by acquisition date or first action",
            "tracking retention curves over daily/weekly/monthly intervals",
            "heatmap matrices and survival analysis curves",
            "identifying churn inflection points"
        ]
    },
    "Explain the difference between data lakes and data warehouses. When would you use each?": {
        "question": "What is change data capture (CDC) and how do tools like Debezium stream database changes into event streams?",
        "keyPoints": [
            "reading database transaction logs directly (Postgres WAL, MySQL binlog)",
            "zero impact on application queries",
            "ordered event streaming to Kafka topics",
            "handling schema changes and snapshotting existing tables"
        ]
    },
    "How would you structure a large Go project? What patterns do you follow?": {
        "question": "Explain context.Context in Go and how it is used for cancellation and timeout propagation.",
        "keyPoints": [
            "WithCancel, WithTimeout, WithDeadline tree propagation",
            "avoids goroutine leaks when downstream calls abort",
            "WithValue for request-scoped metadata (not optional parameters)",
            "listening on ctx.Done() channel in concurrent loops"
        ]
    }
}

updated = 0
for q in data:
    txt = q["question"].strip()
    if txt in second_replacements:
        rep = second_replacements[txt]
        q["question"] = rep["question"]
        q["keyPoints"] = rep["keyPoints"]
        updated += 1

print(f"Updated {updated} remaining duplicate questions!")

with open(r"d:\Kramix.ai\data\question-bank-data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Saved clean question-bank-data.json!")
