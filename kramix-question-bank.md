# Kramix.AI — Demo Mode Question Bank

Structured reference bank for offline-generated demo interviews. Each question includes key points an ideal answer should hit — use these as reference text for embedding-similarity scoring, not verbatim "correct answers."

Format: `Role → Category → Question → Key points`

---

## Shared Behavioral / Screening Round (applies to all roles)

1. **Tell me about yourself.**
   Key points: concise professional summary, relevant experience, why this role, forward-looking close.
2. **Why do you want to work here / in this role?**
   Key points: specific company/role knowledge, alignment with candidate's goals, genuine interest signals.
3. **Describe a challenging project and how you handled it.**
   Key points: clear situation/task/action/result structure, ownership, concrete outcome.
4. **Tell me about a time you disagreed with a teammate or manager.**
   Key points: respectful disagreement, focus on outcome, what was learned.
5. **How do you handle tight deadlines or pressure?**
   Key points: prioritization method, communication with stakeholders, specific example.
6. **Where do you see yourself in 3-5 years?**
   Key points: realistic growth path, aligns with role trajectory, shows ambition without overreach.
7. **Describe a time you made a mistake. What did you do?**
   Key points: ownership, corrective action, lesson applied afterward.
8. **How do you prioritize tasks when everything feels urgent?**
   Key points: a framework (impact/effort, deadlines, stakeholder input), example.
9. **Tell me about a time you had to learn something quickly.**
   Key points: learning approach, resourcefulness, applied outcome.
10. **Why are you leaving your current role / what are you looking for?**
    Key points: positive framing, growth-oriented reasoning, no negativity toward past employer.

---

## Frontend Developer (React)

1. **What is the virtual DOM and why does React use it?**
   Key points: in-memory representation, diffing/reconciliation, batched updates for performance.
2. **Explain the difference between state and props.**
   Key points: props are read-only/passed down, state is local/mutable, triggers re-render on change.
3. **What are React hooks, and why were they introduced?**
   Key points: functional component state/lifecycle without classes, useState/useEffect, reusability via custom hooks.
4. **How does useEffect's dependency array work?**
   Key points: controls when effect re-runs, empty array = mount only, missing deps = runs every render, cleanup function.
5. **How would you optimize a slow-rendering React list?**
   Key points: key prop correctness, React.memo, useMemo/useCallback, virtualization (react-window) for long lists.
6. **What's the difference between controlled and uncontrolled components?**
   Key points: controlled = React state drives input value, uncontrolled = DOM manages it via refs.

## Backend Developer (Node.js / Express)

1. **Explain the Node.js event loop.**
   Key points: single-threaded, non-blocking I/O, call stack, callback/microtask queue, phases (timers, I/O, etc.).
2. **How do you handle errors in async Express routes?**
   Key points: try/catch with async/await, centralized error-handling middleware, avoiding unhandled promise rejections.
3. **What is middleware in Express and how does it work?**
   Key points: functions with access to req/res/next, chain of execution, order matters.
4. **How would you secure a REST API?**
   Key points: authentication (JWT/OAuth), input validation, rate limiting, HTTPS, helmet.js, CORS config.
5. **Explain the difference between SQL and NoSQL, and when you'd pick each.**
   Key points: schema rigidity vs flexibility, relational joins vs document model, consistency vs scalability tradeoffs.
6. **How do you handle database connection pooling?**
   Key points: reusing connections vs opening new ones per request, pool size tuning, avoiding connection exhaustion.

## Full Stack Developer (MERN)

1. **Walk through the data flow of a MERN app from client click to database write.**
   Key points: React event → API call (Axios/fetch) → Express route → Mongoose model → MongoDB → response back up.
2. **How do you manage state across a large React + Node app?**
   Key points: local vs global state, Context API vs Redux/Zustand, server state via React Query.
3. **How would you structure a scalable MERN project folder layout?**
   Key points: separation of concerns (routes/controllers/models), shared config, environment-based settings.
4. **How do you handle authentication across frontend and backend?**
   Key points: JWT issuance on login, storage (httpOnly cookie vs localStorage tradeoffs), token refresh strategy.
5. **What's your approach to deploying a full stack app?**
   Key points: separate frontend/backend hosting vs monorepo, environment variables, CI/CD basics.
6. **How do you debug an issue that only appears in production?**
   Key points: logging/monitoring tools, reproducing with prod-like data, checking env differences.

## Python Developer

1. **Explain Python's GIL and its implications.**
   Key points: Global Interpreter Lock, one thread executes Python bytecode at a time, affects CPU-bound multithreading, workarounds (multiprocessing, async I/O).
2. **What's the difference between a list and a tuple?**
   Key points: mutability, performance, use cases (fixed vs dynamic data).
3. **Explain list comprehensions and when to avoid them.**
   Key points: concise syntax for transforming iterables, avoid when logic gets too complex/unreadable.
4. **How does Python handle memory management?**
   Key points: reference counting, garbage collection for cycles, memory pools.
5. **What are decorators and give a practical use case.**
   Key points: functions wrapping functions, logging/timing/auth examples, `@` syntax sugar.
6. **How would you handle a memory leak in a long-running Python service?**
   Key points: profiling tools (tracemalloc, memory_profiler), identifying reference cycles, closing resources properly.

## Java Developer

1. **Explain the difference between JDK, JRE, and JVM.**
   Key points: JDK = development kit, JRE = runtime environment, JVM = execution engine that runs bytecode.
2. **What is the difference between an abstract class and an interface?**
   Key points: abstract class can have state/partial implementation, interface is a contract (default methods in modern Java), multiple inheritance via interfaces.
3. **Explain garbage collection in Java.**
   Key points: automatic memory management, generational GC (young/old gen), stop-the-world pauses, tuning options.
4. **What are Java Streams and why use them?**
   Key points: functional-style operations on collections, lazy evaluation, map/filter/reduce chaining.
5. **How does exception handling work in Java (checked vs unchecked)?**
   Key points: checked exceptions must be declared/handled, unchecked (RuntimeException) don't require it, try-with-resources.
6. **What is dependency injection and why is it useful?**
   Key points: inversion of control, testability, decoupling components, common in Spring.

## Spring Boot Developer

1. **What problem does Spring Boot solve compared to plain Spring?**
   Key points: auto-configuration, embedded server, starter dependencies, less boilerplate XML config.
2. **Explain the Spring Bean lifecycle.**
   Key points: instantiation, dependency injection, initialization callbacks, destruction.
3. **What is `@RestController` vs `@Controller`?**
   Key points: RestController combines Controller + ResponseBody, returns data directly (JSON) vs view rendering.
4. **How do you handle exceptions globally in Spring Boot?**
   Key points: `@ControllerAdvice` + `@ExceptionHandler`, consistent error response structure.
5. **Explain Spring Data JPA and its benefits.**
   Key points: repository abstraction over JDBC/Hibernate, derived query methods, reduces boilerplate.
6. **How would you secure a Spring Boot API?**
   Key points: Spring Security, JWT filters, role-based access control, method-level security annotations.

## AI Engineer / LLM Engineer

1. **What is RAG (Retrieval-Augmented Generation) and why use it?**
   Key points: combines retrieval from external knowledge with generation, reduces hallucination, keeps model current without retraining.
2. **Explain the difference between fine-tuning and prompt engineering.**
   Key points: fine-tuning changes model weights (costly, permanent), prompting shapes behavior at inference time (cheap, flexible).
3. **What are embeddings and how are they used in search?**
   Key points: vector representations of meaning, cosine similarity for relevance, used in semantic search/RAG.
4. **How do you reduce hallucination in an LLM application?**
   Key points: grounding via RAG, lower temperature, explicit "say I don't know" instructions, output validation.
5. **What is agentic AI, and how does it differ from a simple chatbot?**
   Key points: multi-step planning, tool use, autonomous decision-making across a task vs single-turn Q&A.
6. **How would you evaluate the quality of an LLM-generated response?**
   Key points: human eval, automated metrics (BLEU/ROUGE limitations), LLM-as-judge, task-specific success criteria.

## Machine Learning Engineer

1. **Explain bias-variance tradeoff.**
   Key points: underfitting (high bias) vs overfitting (high variance), model complexity balance, regularization.
2. **How do you handle imbalanced datasets?**
   Key points: resampling (SMOTE, undersampling), class weights, appropriate metrics (F1/precision-recall over accuracy).
3. **What is cross-validation and why use it?**
   Key points: k-fold splitting, more robust performance estimate, reduces overfitting to a single train/test split.
4. **Explain the difference between bagging and boosting.**
   Key points: bagging trains parallel models on random subsets (reduces variance), boosting trains sequentially correcting errors (reduces bias).
5. **How would you deploy a trained ML model to production?**
   Key points: model serialization, serving via API (FastAPI/Flask or managed endpoint), monitoring for drift.
6. **What is feature engineering and give an example.**
   Key points: transforming raw data into predictive features, domain knowledge application, example (extracting day-of-week from timestamp).

## Data Scientist

1. **Walk through your typical data science project workflow.**
   Key points: problem framing, data collection/cleaning, EDA, modeling, evaluation, communication of results.
2. **How do you handle missing data?**
   Key points: understand missingness pattern (MCAR/MAR/MNAR), imputation strategies, dropping vs flagging.
3. **Explain p-value and statistical significance.**
   Key points: probability of observing result under null hypothesis, common threshold (0.05), doesn't imply practical significance.
4. **How would you explain a complex model to a non-technical stakeholder?**
   Key points: analogy-based explanation, focus on business impact, visual aids over technical jargon.
5. **What's the difference between correlation and causation?**
   Key points: correlation shows association, causation requires controlled experiment/causal inference, confounding variables.
6. **How do you decide which metric to optimize for a business problem?**
   Key points: align metric with business goal, consider tradeoffs (precision vs recall), stakeholder input.

## Data Analyst

1. **How would you approach a dataset you've never seen before?**
   Key points: check shape/schema, missing values, distributions, obvious quality issues before analysis.
2. **Explain the difference between a JOIN types in SQL (INNER/LEFT/RIGHT/FULL).**
   Key points: which rows are kept from each table, common use cases for each.
3. **How do you identify and handle outliers?**
   Key points: IQR/z-score methods, domain judgment on whether to remove or investigate.
4. **What makes a good dashboard?**
   Key points: answers a specific question, minimal clutter, right chart type for the data, actionable not just decorative.
5. **How would you explain a drop in a key metric to leadership?**
   Key points: structured investigation (segment breakdown, time-based comparison), root cause before conclusions, clear narrative.
6. **Write a SQL query to find the second-highest value in a column (verbally describe approach).**
   Key points: subquery with MAX excluding top value, or OFFSET/LIMIT with ORDER BY, or window functions (RANK/DENSE_RANK).

## Data Engineer

1. **Explain the difference between ETL and ELT.**
   Key points: transform-before-load vs load-then-transform, modern data warehouses favor ELT for flexibility/scale.
2. **How would you design a pipeline to handle daily batch ingestion of large files?**
   Key points: orchestration tool (Airflow), idempotency, error handling/retries, partitioning strategy.
3. **What is data partitioning and why does it matter?**
   Key points: splitting data by key (date, region) for query performance and manageability.
4. **How do you ensure data quality in a pipeline?**
   Key points: schema validation, anomaly detection, automated tests on row counts/nulls, alerting.
5. **Explain the difference between a data warehouse and a data lake.**
   Key points: structured/schema-on-write vs raw/schema-on-read, use cases for each.
6. **How would you handle schema changes in an upstream source without breaking downstream consumers?**
   Key points: versioning, backward-compatible changes, communication/contract with consumers.

## DevOps Engineer

1. **Explain the CI/CD pipeline concept.**
   Key points: continuous integration (automated build/test on commit), continuous delivery/deployment (automated release), reduces manual error.
2. **What is Infrastructure as Code and why use it?**
   Key points: version-controlled, repeatable infrastructure provisioning (Terraform/CloudFormation), reduces drift.
3. **How do you handle secrets management in a CI/CD pipeline?**
   Key points: dedicated secrets managers (Vault, AWS Secrets Manager), never hardcoding, environment injection.
4. **Explain the difference between containers and virtual machines.**
   Key points: containers share host OS kernel (lightweight), VMs virtualize full hardware (heavier, more isolated).
5. **How would you design a zero-downtime deployment strategy?**
   Key points: blue-green or rolling deployments, health checks, rollback plan.
6. **What metrics would you monitor for a production system?**
   Key points: latency, error rate, throughput, resource utilization (the "four golden signals").

## Cloud Engineer (AWS)

1. **Explain the difference between EC2, Lambda, and ECS.**
   Key points: EC2 = full VM control, Lambda = serverless functions, ECS = container orchestration.
2. **How would you design a highly available architecture on AWS?**
   Key points: multi-AZ deployment, load balancing, auto-scaling, managed database replicas.
3. **What is IAM and why is least-privilege important?**
   Key points: identity and access management, granting only necessary permissions, reduces blast radius of compromised credentials.
4. **Explain the difference between S3 storage classes.**
   Key points: Standard vs Infrequent Access vs Glacier, cost vs retrieval speed tradeoffs.
5. **How do you monitor and alert on AWS infrastructure?**
   Key points: CloudWatch metrics/alarms, log aggregation, dashboards for key services.
6. **How would you approach cost optimization on AWS?**
   Key points: right-sizing instances, reserved/spot instances, unused resource cleanup, cost monitoring tools.

## Mobile Developer (Android / Kotlin)

1. **Explain the Android Activity lifecycle.**
   Key points: onCreate/onStart/onResume/onPause/onStop/onDestroy, state handling across transitions.
2. **What is Jetpack Compose and how does it differ from XML layouts?**
   Key points: declarative UI vs imperative XML+code, less boilerplate, recomposition model.
3. **How do you handle background tasks in Android?**
   Key points: WorkManager for deferrable tasks, coroutines for async work, avoiding blocking the main thread.
4. **Explain Kotlin coroutines and structured concurrency.**
   Key points: lightweight threads, suspend functions, scope-based lifecycle management to avoid leaks.
5. **How would you optimize app startup time?**
   Key points: lazy initialization, reducing work in Application class, baseline profiles.
6. **How do you handle different screen sizes and densities?**
   Key points: density-independent pixels, responsive layouts (ConstraintLayout), resource qualifiers.

## Mobile Developer (iOS / Swift)

1. **Explain the difference between value types and reference types in Swift.**
   Key points: structs/enums (value, copied) vs classes (reference, shared), implications for mutability and performance.
2. **What is ARC and how does it manage memory?**
   Key points: Automatic Reference Counting, strong/weak/unowned references, retain cycles.
3. **Explain the MVVM pattern and why it's popular in iOS.**
   Key points: separation of view logic from business logic, testability, works well with SwiftUI bindings.
4. **How do you handle asynchronous code in Swift?**
   Key points: async/await, completion handlers (older pattern), Combine framework.
5. **What's the difference between UIKit and SwiftUI?**
   Key points: imperative/older vs declarative/newer, interoperability, when each is appropriate.
6. **How would you debug a memory leak in an iOS app?**
   Key points: Instruments (Leaks/Allocations tool), checking for retain cycles in closures, weak self usage.

## React Native Developer

1. **How does React Native bridge JavaScript and native code?**
   Key points: the bridge (or new JSI architecture), async communication between JS thread and native modules.
2. **How do you handle platform-specific code (iOS vs Android)?**
   Key points: Platform.OS checks, `.ios.js`/`.android.js` file extensions.
3. **How would you optimize a React Native app's performance?**
   Key points: minimizing bridge traffic, FlatList optimization, avoiding unnecessary re-renders, Hermes engine.
4. **Explain how navigation typically works in a React Native app.**
   Key points: React Navigation stack/tab/drawer navigators, deep linking considerations.
5. **How do you handle native modules that don't have existing RN support?**
   Key points: writing custom native modules bridging to iOS/Android SDKs.

## Golang Developer

1. **Explain goroutines and channels.**
   Key points: lightweight concurrent functions, channels for safe communication between them, avoiding shared-memory races.
2. **What is the difference between a slice and an array in Go?**
   Key points: arrays are fixed-size, slices are dynamic views over an underlying array.
3. **How does Go handle error handling differently from exceptions?**
   Key points: explicit error return values, no try/catch, encourages handling errors at each call site.
4. **Explain Go's garbage collection approach.**
   Key points: concurrent, low-latency GC, tradeoffs vs manual memory management.
5. **How would you structure a Go microservice project?**
   Key points: cmd/internal/pkg layout conventions, dependency injection without heavy frameworks.

## .NET Developer (C#)

1. **Explain the difference between .NET Framework and .NET Core/.NET 5+.**
   Key points: Windows-only legacy vs cross-platform modern runtime, performance improvements.
2. **What is dependency injection in ASP.NET Core?**
   Key points: built-in DI container, service lifetimes (transient/scoped/singleton).
3. **Explain async/await in C#.**
   Key points: non-blocking I/O, Task-based asynchronous pattern, avoiding deadlocks (ConfigureAwait).
4. **What is Entity Framework and how does it simplify data access?**
   Key points: ORM abstraction over SQL, migrations, LINQ query translation.
5. **How do you handle configuration across environments in ASP.NET Core?**
   Key points: appsettings.json per environment, environment variables, IOptions pattern.

## Flutter Developer

1. **Explain the widget tree and how Flutter renders UI.**
   Key points: everything is a widget, declarative composition, rebuild on state change.
2. **What's the difference between StatelessWidget and StatefulWidget?**
   Key points: immutable vs widgets holding mutable state that triggers rebuilds.
3. **How do you manage state in a larger Flutter app?**
   Key points: Provider, Riverpod, Bloc — tradeoffs in complexity vs scalability.
4. **How does Flutter achieve cross-platform rendering without native UI components?**
   Key points: Skia rendering engine draws directly, consistent UI across platforms.
5. **How would you optimize a Flutter app with jank/dropped frames?**
   Key points: avoiding rebuilds of large subtrees, const constructors, using DevTools performance overlay.

## QA / SDET (Software Development Engineer in Test)

1. **What's the difference between manual and automated testing, and when do you use each?**
   Key points: automation for repetitive/regression tests, manual for exploratory/usability testing.
2. **Explain the testing pyramid.**
   Key points: many unit tests, fewer integration tests, fewest end-to-end tests — cost/speed tradeoffs.
3. **How would you design a test plan for a new feature?**
   Key points: requirements review, edge cases, happy path + negative cases, risk-based prioritization.
4. **What is flaky test and how do you deal with it?**
   Key points: test that passes/fails inconsistently, causes (timing/race conditions/test isolation), quarantine and root-cause approach.
5. **Explain the difference between load testing and stress testing.**
   Key points: load = expected traffic behavior, stress = breaking point/beyond-capacity behavior.
6. **How do you approach test automation framework design?**
   Key points: page object model, reusable utilities, CI integration, reporting.

## Cybersecurity Analyst

1. **Explain the CIA triad.**
   Key points: Confidentiality, Integrity, Availability — foundational security principles.
2. **What is the difference between symmetric and asymmetric encryption?**
   Key points: single shared key vs public/private key pair, use cases for each.
3. **How would you respond to a suspected data breach?**
   Key points: containment first, evidence preservation, root cause investigation, stakeholder/legal notification.
4. **Explain common web vulnerabilities (OWASP Top 10 examples).**
   Key points: SQL injection, XSS, CSRF — cause and basic mitigation for each.
5. **What is the principle of least privilege?**
   Key points: granting minimum access necessary, reducing attack surface.
6. **How do you stay current with emerging threats?**
   Key points: threat intel feeds, CVE monitoring, security community engagement.

## Database Administrator / SQL Developer

1. **Explain database normalization and when you might denormalize.**
   Key points: reducing redundancy via normal forms, denormalizing for read performance in specific cases.
2. **What is indexing and how does it improve query performance?**
   Key points: data structure (B-tree typically) for faster lookups, tradeoff with write performance.
3. **Explain ACID properties.**
   Key points: Atomicity, Consistency, Isolation, Durability — transaction guarantees.
4. **How would you diagnose a slow-running query?**
   Key points: EXPLAIN/query plan analysis, checking for missing indexes, N+1 query patterns.
5. **What's the difference between a clustered and non-clustered index?**
   Key points: clustered determines physical row order (one per table), non-clustered is a separate lookup structure.
6. **How do you approach database backup and disaster recovery planning?**
   Key points: backup frequency/retention, point-in-time recovery, testing restores regularly.

## UI/UX Designer

1. **Walk through your design process from brief to final handoff.**
   Key points: research, wireframes, prototyping, usability testing, design system alignment, dev handoff.
2. **How do you balance user needs with business goals?**
   Key points: data-informed tradeoffs, framing decisions around both metrics and user pain points.
3. **What makes for good accessibility in design?**
   Key points: color contrast, keyboard navigation, screen reader support, WCAG guidelines awareness.
4. **How do you handle feedback from stakeholders that conflicts with user research?**
   Key points: presenting evidence, negotiating tradeoffs, not dismissing either side outright.
5. **Explain the difference between UX and UI.**
   Key points: UX = overall experience/flow/usability, UI = visual/interactive surface layer.
6. **How do you validate a design decision before full implementation?**
   Key points: prototyping, A/B testing, usability testing with real users.

## Technical Product Manager

1. **How do you prioritize a product backlog with limited engineering capacity?**
   Key points: framework (RICE/impact-effort), stakeholder alignment, saying no clearly.
2. **How do you write a good user story or spec?**
   Key points: clear acceptance criteria, user-centered framing, avoiding prescribing implementation.
3. **How do you work with engineers to scope technical tradeoffs?**
   Key points: understanding technical constraints, collaborative scoping, MVP vs full-scope framing.
4. **How do you measure whether a feature launch was successful?**
   Key points: predefined success metrics before launch, post-launch analysis, iterating based on data.
5. **Describe a time you had to say no to a stakeholder's request.**
   Key points: clear reasoning, alternative offered, maintaining relationship.

## Site Reliability Engineer (SRE)

1. **Explain SLIs, SLOs, and SLAs.**
   Key points: indicator (measured metric), objective (internal target), agreement (external commitment with consequences).
2. **What is an error budget and how does it guide decisions?**
   Key points: acceptable amount of unreliability before feature work pauses for stability work.
3. **How would you approach an incident postmortem?**
   Key points: blameless culture, timeline reconstruction, root cause, actionable follow-ups.
4. **How do you design for graceful degradation?**
   Key points: fallback behavior when a dependency fails, circuit breakers, feature flags to disable non-critical paths.
5. **What's your approach to capacity planning?**
   Key points: historical traffic trends, load testing, headroom for spikes.

## Generative AI / Prompt Engineer

1. **What is prompt engineering and why does it matter for LLM applications?**
   Key points: crafting input to reliably steer model output, reduces need for fine-tuning, iterative refinement.
2. **Explain few-shot vs zero-shot prompting.**
   Key points: few-shot provides examples in the prompt, zero-shot relies on instructions alone.
3. **How do you structure a prompt for consistent, parseable output (e.g., JSON)?**
   Key points: explicit format instructions, examples, sometimes constrained decoding/function calling.
4. **What's the difference between temperature and top-p sampling?**
   Key points: temperature scales randomness of token selection, top-p limits to a cumulative probability mass — both control creativity vs determinism.
5. **How would you test and iterate on a prompt systematically?**
   Key points: eval set of representative inputs, scoring rubric, version tracking of prompt changes.

## Technical Support Engineer

1. **How do you handle a customer who is frustrated and technical issue is unclear?**
   Key points: active listening, structured troubleshooting questions, calm de-escalation.
2. **Walk through your approach to troubleshooting an unfamiliar bug report.**
   Key points: reproduce first, check logs/error messages, isolate variables, escalate with clear context if needed.
3. **How do you decide when to escalate an issue vs solve it yourself?**
   Key points: complexity/scope assessment, SLA awareness, escalation with full context to avoid back-and-forth.
4. **How do you document a resolved issue for future reference?**
   Key points: clear reproduction steps, root cause, resolution steps, searchable KB formatting.
5. **How do you manage multiple concurrent support tickets with different priorities?**
   Key points: triage by severity/impact, clear communication of expected timelines to each customer.

## Distributed Systems Engineer

1. **How do you design a consensus-based distributed lock service?**
   Key points: Raft or Paxos consensus algorithm, lease renewal mechanisms, fencing tokens to prevent split-brain writes.
2. **Explain the CAP theorem and PACELC extension in modern distributed databases.**
   Key points: Consistency vs Availability during Partition; Else Latency vs Consistency trade-offs during normal operation.
3. **How do you manage vector clock drift and causality in multi-region active-active clusters?**
   Key points: Vector clocks, hybrid logical clocks (HLC), conflict-free replicated data types (CRDTs), last-write-wins resolution.
4. **What strategies mitigate cascading failures and thread starvation in microservices?**
   Key points: Circuit breakers, adaptive rate limiting, client-side load balancing with power-of-two choices, bulkheading.
5. **How would you architect a distributed rate limiter scaling to 500,000 QPS with sub-5ms latency?**
   Key points: Sliding window counter in Redis cluster, local token bucket caching, asynchronous batch synchronization.
6. **How do you implement distributed transaction recovery using 2PC (Two-Phase Commit) vs Saga orchestrator pattern?**
   Key points: Prepare and Commit phases, coordinator blocking vulnerabilities, Saga compensating transactions, forward/backward recovery strategies.
7. **How do you design an idempotent event processing pipeline in Kafka under at-least-once delivery semantics?**
   Key points: Unique transaction IDs, deduplication store with Redis/DynamoDB, atomic consumer offsets, idempotent database upserts.
8. **Explain how consistent hashing with virtual nodes minimizes data movement during cluster scaling.**
   Key points: Hash ring partitioning, virtual node distribution preventing hot spots, minimal key reassignment on node join/leave.
9. **How do you prevent split-brain scenarios and manage quorum consensus in multi-datacenter etcd clusters?**
   Key points: Odd node counts (3, 5, 7), majority quorum requirements (N/2 + 1), leader election timeouts, network partition isolation.
10. **Walk through designing a high-throughput distributed tracing collector for microservice observability.**
    Key points: OpenTelemetry protocol (OTLP), head-based vs tail-based sampling, batching collector buffering, Jaeger/Zipkin backend storage.

## AI Infrastructure Architect

1. **How do you optimize GPU cluster utilization for multi-node LLM distributed training?**
   Key points: Megatron-LM tensor and pipeline parallelism, Zero Redundancy Optimizer (ZeRO-3), FlashAttention-2 memory reduction.
2. **Explain KV-cache optimization techniques in high-throughput LLM inference.**
   Key points: PagedAttention (vLLM) memory allocation, continuous batching, speculative decoding, quantized KV-cache (FP8/INT4).
3. **How do you architect a vector database cluster for billion-scale hybrid semantic search?**
   Key points: HNSW index graph partitioning, product quantization (PQ), disk-ANN storage, hybrid lexical-dense re-ranking.
4. **How do you prevent data leakage and ensure prompt injection resilience in enterprise LLM gateways?**
   Key points: Dual-LLM validation architecture, regex and embedding guardrails, canary token tracking, untrusted XML sandboxing.
5. **How would you build a real-time feature store for sub-20ms model inference?**
   Key points: Low-latency key-value store (Redis/RocksDB), streaming ingestion via Kafka, point-in-time correctness, feature drift detection.
6. **How do you optimize inference throughput for LLM serving using speculative decoding and Medusa heads?**
   Key points: Small draft model draft token generation, target LLM parallel verification step, acceptance rate metrics, reduced latency per token.
7. **Explain how FlashAttention-3 leverages GPU Tensor Cores and asynchronous memory copy for long-context windows.**
   Key points: Tiling attention computation in SRAM, FP8 precision GEMM execution, overlapping memory transfers with Tensor Core math, linear memory complexity.
8. **How do you design an automated model validation and canary deployment pipeline for real-time safety guardrails?**
   Key points: Shadow traffic mirroring, automated regression benchmarks (MMLU, GSM8K, toxicity filters), automated rollback triggers, traffic shifting.
9. **How do you approach quantization-aware training (QAT) vs post-training quantization (PTQ) for edge LLM deployment?**
   Key points: Simulated quantization during backprop, weight vs activation clipping, AWQ/GPTQ algorithms, latency and accuracy retention trade-offs.
10. **Walk through building an automated dataset deduplication pipeline using MinHash LSH and semantic embedding clustering.**
    Key points: Document N-gram extraction, MinHash signature generation, Locality-Sensitive Hashing (LSH) bucket candidate generation, cosine similarity verification.

---

## Usage Notes for Integration

- Roles not covered here should trigger a clear "demo mode doesn't cover this role yet" message rather than a silent fallback.
- Behavioral questions can be mixed in with any technical role's demo flow (e.g., 2 technical + 1 behavioral per round).
- Key points are meant as embedding-reference text for similarity scoring, not exact-match strings — phrase them naturally when generating reference embeddings.
- This bank should be regenerated/expanded periodically as new roles trend (add via the offline batch-generation script rather than hand-editing at scale).
