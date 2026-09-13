import json

with open(r"d:\Kramix.ai\data\question-bank-data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

replacements = {
    "Explain Python's Global Interpreter Lock (GIL) and its implications for multi-threaded applications.": {
        "question": "What are Python generators and iterators? How does the yield keyword manage execution state and memory?",
        "keyPoints": [
            "generators use lazy evaluation",
            "yield pauses execution and maintains state",
            "memory efficient for large sequences",
            "implements __iter__ and __next__ protocols"
        ]
    },
    "What are Python decorators and how do they work under the hood?": {
        "question": "Explain Python context managers and the with statement. How do you write a custom context manager?",
        "keyPoints": [
            "__enter__ and __exit__ dunder methods",
            "guaranteed resource cleanup even on exception",
            "contextlib.contextmanager utility",
            "practical use cases like DB connections or file locks"
        ]
    },
    "Explain Python's memory management and garbage collection strategy.": {
        "question": "What is the difference between shallow copy and deep copy in Python? When would you use each?",
        "keyPoints": [
            "shallow copy copies references to nested objects",
            "deep copy recursively duplicates nested objects",
            "copy module copy() vs deepcopy()",
            "pitfalls with mutable default arguments or cyclic references"
        ]
    },
    "What is the Virtual DOM and how does reconciliation work in React?": {
        "question": "How does React fiber architecture work and how does it enable concurrent rendering features?",
        "keyPoints": [
            "two-phase reconciliation: render and commit",
            "incremental rendering and priority-based scheduling",
            "fiber node tree representation",
            "enables Suspense and transitions"
        ]
    },
    "What are React Hooks and what rules govern their usage?": {
        "question": "How do you handle error boundaries in React, and what errors can they NOT catch?",
        "keyPoints": [
            "componentDidCatch and getDerivedStateFromError",
            "catches rendering errors in child tree",
            "cannot catch event handler errors or async code",
            "fallback UI graceful degradation"
        ]
    },
    "What is the difference between controlled and uncontrolled components in React forms?": {
        "question": "What are React portals, and when should you use them?",
        "keyPoints": [
            "ReactDOM.createPortal renders children outside DOM hierarchy",
            "event bubbling still follows React component tree",
            "ideal for modals, tooltips, and toasts",
            "prevents z-index or overflow:hidden clipping issues"
        ]
    },
    "How do you handle database connection pooling in a Node.js application?": {
        "question": "How does the Node.js cluster module and worker threads work for scaling CPU-intensive tasks?",
        "keyPoints": [
            "cluster forks separate OS processes sharing server ports",
            "worker threads share memory via ArrayBuffer for CPU-heavy tasks",
            "libuv thread pool vs worker threads",
            "process managers like PM2 in production"
        ]
    },
    "Describe your approach to state management across a full-stack MERN application.": {
        "question": "How do you implement real-time bidirectional communication in a MERN stack application?",
        "keyPoints": [
            "WebSockets vs Server-Sent Events (SSE)",
            "Socket.io room and namespace architecture",
            "managing connection state and reconnection strategies",
            "scaling WebSockets with Redis adapter"
        ]
    },
    "Explain the difference between ETL and ELT in modern data architectures.": {
        "question": "How does columnar storage (like Apache Parquet or ORC) optimize analytical query performance compared to row-based formats?",
        "keyPoints": [
            "column projection skips unneeded columns",
            "high compression ratios on similar data types",
            "dictionary encoding and run-length encoding",
            "predicate pushdown and min/max statistics"
        ]
    },
    "How does data partitioning and bucketing improve query performance in distributed engines?": {
        "question": "What is the difference between batch processing and stream processing? How does Apache Kafka integrate with processing frameworks?",
        "keyPoints": [
            "bounded vs unbounded data streams",
            "low latency event-driven processing",
            "Kafka distributed commit log and consumer groups",
            "exactly-once vs at-least-once processing semantics"
        ]
    },
    "How would you design a CI/CD pipeline for a microservices architecture?": {
        "question": "What is GitOps and how does tools like ArgoCD or Flux enforce declarative infrastructure state?",
        "keyPoints": [
            "Git as single source of truth for desired state",
            "pull-based synchronization vs push-based CI",
            "automatic drift detection and self-healing",
            "immutable audit trail and easy rollbacks"
        ]
    },
    "How do you manage secrets and sensitive configuration in Kubernetes?": {
        "question": "Explain how Kubernetes Horizontal Pod Autoscaler (HPA) works with custom and external metrics.",
        "keyPoints": [
            "metrics-server for CPU/memory utilization",
            "Prometheus Adapter for custom application metrics",
            "scaling policies and stabilization windows",
            "interaction with cluster autoscaler"
        ]
    },
    "How would you design a highly available and fault-tolerant architecture on AWS?": {
        "question": "Explain AWS VPC networking: subnets, route tables, internet gateways, and NAT gateways.",
        "keyPoints": [
            "public subnets route directly to Internet Gateway",
            "private subnets use NAT Gateway for outbound traffic",
            "Security Groups (stateful) vs Network ACLs (stateless)",
            "VPC peering and Transit Gateway for inter-VPC traffic"
        ]
    },
    "What is Jetpack Compose and how does it differ from the traditional View system?": {
        "question": "Explain the Android Activity and Fragment lifecycle, and how ViewModel survives configuration changes.",
        "keyPoints": [
            "onCreate, onStart, onResume, onPause, onStop, onDestroy",
            "ViewModelStore retains ViewModel across Activity recreation",
            "SavedStateHandle for system-initiated process death",
            "avoiding memory leaks from context references"
        ]
    },
    "Explain Kotlin coroutines and how they differ from Java threads for Android development.": {
        "question": "What is ProGuard / R8 in Android build processes and how does it optimize APK size and security?",
        "keyPoints": [
            "code shrinking and dead code elimination",
            "resource shrinking",
            "obfuscation of class and member names",
            "keep rules for reflection and serialization"
        ]
    },
    "How does the React Native bridge work, and what are the performance implications?": {
        "question": "Explain the New Architecture in React Native: JSI, Fabric, and TurboModules.",
        "keyPoints": [
            "JavaScript Interface (JSI) replaces asynchronous JSON bridge with direct C++ bindings",
            "Fabric concurrent rendering engine",
            "TurboModules lazy-loads native modules on demand",
            "synchronous native method invocation"
        ]
    },
    "Explain Go's goroutines and channels. How do they enable concurrent programming?": {
        "question": "What is the difference between pointer receivers and value receivers in Go method declarations?",
        "keyPoints": [
            "pointer receiver allows mutating struct state",
            "avoids copying large structs on each method call",
            "value receiver provides immutability safety",
            "interface satisfaction rules with pointer vs value receivers"
        ]
    },
    "Explain Go's memory management and garbage collector.": {
        "question": "What are Go modules, and how does semantic import versioning and go.mod work?",
        "keyPoints": [
            "dependency version resolution via Minimal Version Selection (MVS)",
            "vendor directory vs module cache",
            "semantic versioning requirements for v2+ modules",
            "go.sum checksum verification for reproducible builds"
        ]
    },
    "What are the differences between .NET Framework, .NET Core, and .NET 5+?": {
        "question": "What is the difference between value types and reference types in C#? Explain boxing and unboxing.",
        "keyPoints": [
            "value types stored on stack (structs, primitives), reference types on heap (classes)",
            "boxing wraps value type in object reference on heap",
            "unboxing extracts value type from object reference",
            "performance implications of heap allocations and GC pressure"
        ]
    },
    "What is dependency injection in .NET and how does the built-in DI container work?": {
        "question": "Explain the differences between Transient, Scoped, and Singleton service lifetimes in ASP.NET Core.",
        "keyPoints": [
            "Transient created every time requested",
            "Scoped created once per client request (HTTP request scope)",
            "Singleton created once for application lifetime",
            "captive dependency anti-pattern (scoped in singleton)"
        ]
    },
    "Explain async/await in C# and how it differs from multi-threading.": {
        "question": "What are C# records, and how do they differ from classes and structs?",
        "keyPoints": [
            "record provides value-based equality semantics out of the box",
            "built-in non-destructive mutation with with expression",
            "concise positional syntax with primary constructors",
            "ideal for DTOs and immutable domain models"
        ]
    },
    "Explain Flutter's widget tree and how the framework handles rendering.": {
        "question": "Explain the three trees in Flutter: Widget Tree, Element Tree, and RenderObject Tree.",
        "keyPoints": [
            "Widget tree is lightweight immutable configuration",
            "Element tree manages lifecycle and state, coordinates updates",
            "RenderObject tree handles layout, sizing, and painting on screen",
            "diffing minimizes expensive layout recalculations"
        ]
    },
    "What is the difference between StatelessWidget and StatefulWidget? When do you use each?": {
        "question": "What are Flutter Keys, and when are they necessary (e.g. ValueKey, GlobalKey)?",
        "keyPoints": [
            "Keys preserve state when widgets move around in the widget tree",
            "ValueKey for identifying items in reorderable lists",
            "GlobalKey allows accessing state across the tree and across builds",
            "without keys, Element tree matches by type and position causing stale state"
        ]
    },
    "Explain the testing pyramid and how you decide what to test at each level.": {
        "question": "What is the Page Object Model (POM) in UI automation, and what benefits does it provide?",
        "keyPoints": [
            "separates test logic from UI element selectors and interactions",
            "reduces maintenance burden when UI changes",
            "improves test readability and code reusability",
            "clean encapsulation of page actions and assertions"
        ]
    },
    "How would you design a test automation framework from scratch?": {
        "question": "What is contract testing (e.g. Pact) and how does it prevent breaking changes in microservices?",
        "keyPoints": [
            "verifies interactions between consumer and provider against agreed contract",
            "runs fast in CI without deploying full microservice environment",
            "replaces brittle end-to-end integration environments",
            "consumer-driven contract workflow"
        ]
    },
    "How would you respond to a suspected data breach? Walk through your incident response process.": {
        "question": "What is Zero Trust Architecture, and what are its core principles?",
        "keyPoints": [
            "never trust, always verify principle",
            "explicit verification of identity, device, and context",
            "least privilege access and micro-segmentation",
            "assume breach posture with continuous monitoring"
        ]
    },
    "How would you diagnose and fix a slow SQL query?": {
        "question": "Explain Write-Ahead Logging (WAL) and how relational databases guarantee durability and recovery.",
        "keyPoints": [
            "changes recorded to WAL sequentially before writing to disk pages",
            "ensures crash recovery and transaction rollback",
            "enables point-in-time recovery (PITR) and replication",
            "trade-offs with checkpointing and disk I/O"
        ]
    },
    "How do you implement database backup and disaster recovery strategies?": {
        "question": "What are window functions in SQL (e.g. ROW_NUMBER, RANK, LEAD, LAG) and how do they differ from GROUP BY?",
        "keyPoints": [
            "compute aggregate or relative values without collapsing rows",
            "OVER clause with PARTITION BY and ORDER BY",
            "running totals and moving averages",
            "ranking and gap-and-island analysis"
        ]
    },
    "How do you prioritize features when you have limited engineering resources?": {
        "question": "Explain how you run A/B tests to validate product hypotheses. How do you determine sample size and statistical significance?",
        "keyPoints": [
            "hypothesis formulation with primary and guardrail metrics",
            "minimum detectable effect (MDE) and sample size calculation",
            "p-value, confidence intervals, and statistical power",
            "avoiding common pitfalls like peeking or false positives"
        ]
    },
    "Describe how you would define and track success metrics for a new product feature.": {
        "question": "How do you define and manage Service Level Agreements (SLAs) and SLOs with enterprise customers?",
        "keyPoints": [
            "translating customer expectations into measurable SLIs",
            "setting realistic SLO targets and error budgets",
            "defining contractual SLA penalties and remediation plans",
            "balancing feature velocity against reliability commitments"
        ]
    },
    "What are SLIs, SLOs, and SLAs? How do they relate to each other?": {
        "question": "What is canary deployment and how do automated canary analysis tools evaluate release health?",
        "keyPoints": [
            "routing a small percentage of production traffic to new version",
            "comparing error rates, latency, and resource metrics against baseline",
            "automatic automated rollback on metric degradation",
            "progressive traffic shifting (5% -> 25% -> 100%)"
        ]
    },
    "What is a postmortem/incident review and what makes one effective?": {
        "question": "Explain distributed tracing (e.g. OpenTelemetry) and how trace context is propagated across microservices.",
        "keyPoints": [
            "TraceId and SpanId correlation across HTTP/gRPC boundaries",
            "W3C Trace Context propagation headers",
            "identifying cross-service latency bottlenecks and errors",
            "sampling strategies (head vs tail-based) to control storage costs"
        ]
    },
    "How do you approach capacity planning for a growing service?": {
        "question": "How do you design a robust rate-limiting and shedding system to protect services under heavy load?",
        "keyPoints": [
            "Token bucket and leaky bucket algorithms",
            "distributed rate limiting using Redis",
            "load shedding returning HTTP 429 / 503 early before queue saturation",
            "client retry with exponential backoff and jitter"
        ]
    },
    "What is prompt engineering and what techniques produce the most reliable LLM outputs?": {
        "question": "Explain Retrieval-Augmented Generation (RAG). What are the key stages in a production RAG pipeline?",
        "keyPoints": [
            "document ingestion, chunking, and embedding generation",
            "vector database indexing (HNSW, IVFFlat)",
            "similarity retrieval and reranking (cross-encoders)",
            "prompt augmentation and hallucination guardrails"
        ]
    },
    "Explain the concept of temperature and top-p sampling in LLM generation.": {
        "question": "What is model quantization (e.g. INT8, INT4, AWQ) and how does it reduce memory and latency for LLM inference?",
        "keyPoints": [
            "converting FP32/FP16 weights to lower precision integers",
            "drastically reduces GPU VRAM requirements",
            "enables running large models on consumer hardware",
            "post-training quantization (PTQ) vs quantization-aware training (QAT)"
        ]
    },
    "How would you handle an escalation from an angry enterprise customer?": {
        "question": "How do you read and interpret HTTP status codes (4xx vs 5xx) and server access logs to isolate client vs server faults?",
        "keyPoints": [
            "4xx client errors (400, 401, 403, 404, 429)",
            "5xx server errors (500, 502 Bad Gateway, 503 Unavailable, 504 Timeout)",
            "analyzing request/response headers and IP addresses in access logs",
            "correlating timestamps with system alerts"
        ]
    },
    "How do you troubleshoot an issue that you cannot reproduce locally?": {
        "question": "What tools and commands do you use to diagnose network connectivity issues (e.g., DNS, latency, port reachability)?",
        "keyPoints": [
            "ping and traceroute/mtr for latency and packet loss",
            "nslookup/dig for DNS resolution issues",
            "curl -v and telnet/nc for port and TLS handshake testing",
            "netstat/ss for active connections and listening ports"
        ]
    }
}

updated_count = 0
for q in data:
    txt = q["question"].strip()
    if txt in replacements:
        rep = replacements[txt]
        q["question"] = rep["question"]
        q["keyPoints"] = rep["keyPoints"]
        updated_count += 1

print(f"Replaced {updated_count} twin questions out of {len(replacements)} mapped!")

with open(r"d:\Kramix.ai\data\question-bank-data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Saved updated question-bank-data.json!")
