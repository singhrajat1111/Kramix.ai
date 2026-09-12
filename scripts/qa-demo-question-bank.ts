import {
  loadQuestionBank,
  getQuestionsForRole,
  getAvailableCanonicalRoles,
  getSharedBehavioralQuestions,
  getDemoQuestionsForRole,
} from "../src/lib/demo/question-bank";
import { shouldShowUpgradeGate, DEMO_QUESTION_LIMIT, getDemoQuestionLimit } from "../src/lib/demo/session-limit";
import { resolveCanonicalRole, ROLE_ALIAS_REGISTRY } from "../src/lib/demo/role-aliases";

console.log("================================================================================");
console.log("KRAMIX.AI: DEMO QUESTION BANK & UPGRADE GATING FORENSIC QA SUITE");
console.log("================================================================================\n");

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

// --- SUITE 1: Parser Integrity & Exact Count Guard ---
console.log("--- SUITE 1: Parser Integrity & Exact Count Guard ---");
const allQuestions = loadQuestionBank();
assert(Array.isArray(allQuestions), "loadQuestionBank returns an array");
assert(
  allQuestions.length === 198,
  `Exact total question count guard: expected 198, got ${allQuestions.length}`
);

const behavioralQuestions = getSharedBehavioralQuestions();
assert(
  behavioralQuestions.length === 10,
  `Shared behavioral questions: expected 10, got ${behavioralQuestions.length}`
);

const technicalQuestions = allQuestions.filter((q) => q.category === "technical");
assert(
  technicalQuestions.length === 188,
  `Total technical questions: expected 188, got ${technicalQuestions.length}`
);

const allHaveKeyPoints = allQuestions.every(
  (q) => Array.isArray(q.keyPoints) && q.keyPoints.length > 0 && q.question.length > 5
);
assert(allHaveKeyPoints, "All questions have non-empty question text and key points array");

// --- SUITE 2: Canonical Role Coverage ---
console.log("\n--- SUITE 2: Canonical Role Coverage ---");
const canonicalRoles = getAvailableCanonicalRoles();
assert(
  canonicalRoles.length === 30,
  `Canonical technical roles count: expected 30, got ${canonicalRoles.length}`
);

for (const role of canonicalRoles) {
  const questions = getQuestionsForRole(role);
  assert(
    questions !== null && questions.length >= 4,
    `Role covered: "${role}" resolves to ${questions?.length || 0} questions`
  );
}

// --- SUITE 3: Role Alias Resolution ---
console.log("\n--- SUITE 3: Role Alias Resolution ---");
const aliasTestCases = [
  { input: "React Developer", expected: "Frontend Developer (React)" },
  { input: "Frontend Engineer", expected: "Frontend Developer (React)" },
  { input: "Node.js Backend Developer", expected: "Backend Developer (Node.js / Express)" },
  { input: "Fullstack MERN Engineer", expected: "Full Stack Developer (MERN)" },
  { input: "Python Engineer", expected: "Python Developer" },
  { input: "Core Java Developer", expected: "Core Java Developer" },
  { input: "core java", expected: "Core Java Developer" },
  { input: "Java Developer", expected: "Java Developer" },
  { input: "java developer", expected: "Java Developer" },
  { input: "Spring Boot Engineer", expected: "Spring Boot Developer" },
  { input: "LLM Engineer", expected: "AI Engineer / LLM Engineer" },
  { input: "MLE", expected: "Machine Learning Engineer" },
  { input: "AWS Cloud Engineer", expected: "Cloud Engineer (AWS)" },
  { input: "Kotlin Android Developer", expected: "Mobile Developer (Android / Kotlin)" },
  { input: "SwiftUI Developer", expected: "Mobile Developer (iOS / Swift)" },
  { input: "SDET", expected: "QA / SDET (Software Development Engineer in Test)" },
  { input: "SRE", expected: "Site Reliability Engineer (SRE)" },
  { input: "Prompt Engineer", expected: "Generative AI / Prompt Engineer" },
];

for (const tc of aliasTestCases) {
  const resolved = resolveCanonicalRole(tc.input, canonicalRoles);
  assert(
    resolved === tc.expected,
    `Alias "${tc.input}" -> "${tc.expected}"`,
    `Got "${resolved}"`
  );
}

// --- SUITE 4: Token Boundary & False-Positive Isolation ---
console.log("\n--- SUITE 4: Token Boundary & False-Positive Isolation ---");

// Test: "JavaScript Developer" must NEVER match "Java Developer"
const jsResolved = resolveCanonicalRole("JavaScript Developer", canonicalRoles);
assert(
  jsResolved !== "Java Developer" && jsResolved !== "Core Java Developer",
  `"JavaScript Developer" must not falsely match Java Developer or Core Java Developer (got: ${jsResolved || "uncovered"})`
);

// Test: "Data Analyst" vs "Data Engineer"
const dataAnalyst = resolveCanonicalRole("Data Analyst", canonicalRoles);
const dataEngineer = resolveCanonicalRole("Data Engineer", canonicalRoles);
assert(
  dataAnalyst === "Data Analyst" && dataEngineer === "Data Engineer",
  `"Data Analyst" and "Data Engineer" resolve distinctly without collision`
);

// Test: "React Native" must NOT resolve to "Frontend Developer (React)"
const rnResolved = resolveCanonicalRole("React Native Engineer", canonicalRoles);
assert(
  rnResolved === "React Native Developer",
  `"React Native Engineer" resolves to "React Native Developer", not web React (got: ${rnResolved})`
);

// --- SUITE 5: Uncovered Role Gate ---
console.log("\n--- SUITE 5: Uncovered Role Gate ---");
const uncoveredRoles = [
  "Marketing Manager",
  "Chief Financial Officer",
  "Barista",
  "Aircraft Pilot",
  "Real Estate Agent",
];

for (const role of uncoveredRoles) {
  const questions = getQuestionsForRole(role);
  assert(
    questions === null,
    `Uncovered role "${role}" returns null for upgrade CTA trigger`
  );
}

// --- SUITE 6: Demo Session Curation ---
console.log("\n--- SUITE 6: Demo Session Curation ---");
const demoFrontend = getDemoQuestionsForRole("Frontend Developer (React)", DEMO_QUESTION_LIMIT);
assert(demoFrontend.roleCovered === true, "Frontend role marked as covered");
assert(
  demoFrontend.questions.length === 4,
  `Curated demo questions length (Frontend): expected 4, got ${demoFrontend.questions.length}`
);

const techCount = demoFrontend.questions.filter((q) => q.category === "technical").length;
const behCount = demoFrontend.questions.filter((q) => q.category === "behavioral").length;
assert(techCount === 3, `Demo technical count: expected 3, got ${techCount}`);
assert(behCount === 1, `Demo behavioral count: expected 1, got ${behCount}`);

const uniqueTexts = new Set(demoFrontend.questions.map((q) => q.question));
assert(uniqueTexts.size === 4, "All 4 questions in demo session are unique (no duplicates)");

// Test Core Java 5-question limit & random selection from 10 Core Java questions
const demoCoreJava = getDemoQuestionsForRole("core java");
assert(demoCoreJava.roleCovered === true, "Core Java role marked as covered");
assert(demoCoreJava.canonicalRole === "Core Java Developer", 'Canonical role is "Core Java Developer"');
assert(
  demoCoreJava.questions.length === 5,
  `Curated demo questions length for Core Java: expected 5, got ${demoCoreJava.questions.length}`
);
const coreJavaTechCount = demoCoreJava.questions.filter((q) => q.category === "technical").length;
assert(coreJavaTechCount === 5, `Core Java technical question count: expected 5, got ${coreJavaTechCount}`);
const coreJavaUnique = new Set(demoCoreJava.questions.map((q) => q.question));
assert(coreJavaUnique.size === 5, "All 5 Core Java questions in demo session are unique");

// --- SUITE 7: Session Limit & Gating Logic ---
console.log("\n--- SUITE 7: Session Limit & Gating Logic ---");
assert(DEMO_QUESTION_LIMIT === 4, "DEMO_QUESTION_LIMIT is 4");
assert(getDemoQuestionLimit("Frontend Developer (React)") === 4, "Standard role question limit is 4");
assert(getDemoQuestionLimit("Core Java Developer") === 5, "Core Java Developer question limit is 5");
assert(getDemoQuestionLimit("core java") === 5, "Alias 'core java' question limit is 5");

assert(shouldShowUpgradeGate(0) === false, "0 questions answered: gate closed (false)");
assert(shouldShowUpgradeGate(1) === false, "1 question answered: gate closed (false)");
assert(shouldShowUpgradeGate(3) === false, "3 questions answered: gate closed (false)");
assert(shouldShowUpgradeGate(4) === true, "4 questions answered (default): gate engaged (true)");

assert(shouldShowUpgradeGate(4, "core java") === false, "4 questions answered (Core Java): gate closed (false)");
assert(shouldShowUpgradeGate(5, "core java") === true, "5 questions answered (Core Java): gate engaged (true)");

// --- SUITE 8: Contact Author Mailto Link Generation ---
console.log("\n--- SUITE 8: Contact Author Mailto Link Generation ---");
const testRole = "Staff Machine Learning Engineer";
const testCompany = "Google";
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "singh.rajat70880@gmail.com";
const subject = encodeURIComponent(`Kramix API Access Request — ${testRole} @ ${testCompany}`);
const body = encodeURIComponent(`Hi, I'd like access to Kramix live mode.\nRole: ${testRole}\nCompany: ${testCompany}`);
const mailto = `mailto:${contactEmail}?subject=${subject}&body=${body}`;

assert(mailto.includes("singh.rajat70880@gmail.com"), "Mailto contains configured contact email");
assert(mailto.includes("Staff%20Machine%20Learning%20Engineer"), "Mailto subject contains target role");
assert(mailto.includes("Google"), "Mailto body contains target company");

console.log("\n================================================================================");
console.log(`QA RESULTS: ${passed} OF ${passed + failed} TESTS PASSED`);
console.log("================================================================================\n");

if (failed > 0) {
  process.exit(1);
}
