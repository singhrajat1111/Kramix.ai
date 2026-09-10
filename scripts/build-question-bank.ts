import fs from "fs";
import path from "path";

export interface DemoQuestion {
  role: string;
  category: "behavioral" | "technical";
  question: string;
  keyPoints: string[];
}

export function parseQuestionBankMarkdown(markdownContent: string): DemoQuestion[] {
  const lines = markdownContent.split(/\r?\n/);
  const questions: DemoQuestion[] = [];

  let currentRole = "";
  let currentCategory: "behavioral" | "technical" = "technical";
  let currentQuestion = "";
  let currentKeyPoints: string[] = [];

  const flushQuestion = () => {
    if (currentQuestion && currentRole) {
      questions.push({
        role: currentRole,
        category: currentCategory,
        question: currentQuestion,
        keyPoints: currentKeyPoints,
      });
      currentQuestion = "";
      currentKeyPoints = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Section headers: ## Role
    if (line.startsWith("## ")) {
      flushQuestion();
      const rawHeader = line.replace(/^##\s+/, "").trim();

      // Skip non-role documentation headers
      if (rawHeader.toLowerCase().includes("usage notes")) {
        currentRole = "";
        continue;
      }

      if (rawHeader.toLowerCase().includes("shared behavioral")) {
        currentRole = "Shared Behavioral";
        currentCategory = "behavioral";
      } else {
        currentRole = rawHeader;
        currentCategory = "technical";
      }
      continue;
    }

    if (!currentRole) continue;

    // Match numbered item: N. **Question text**
    const questionMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*/);
    if (questionMatch) {
      flushQuestion();
      currentQuestion = questionMatch[1].trim();
      continue;
    }

    // Match Key points line
    if (line.toLowerCase().startsWith("key points:")) {
      const rawPoints = line.replace(/^key points:\s*/i, "").trim();
      // Split key points by comma, semicolon, or bullet delimiters while preserving phrasing
      currentKeyPoints = rawPoints
        .split(/[,;]\s+/)
        .map((p) => p.trim().replace(/\.$/, ""))
        .filter(Boolean);
    }
  }

  flushQuestion();
  return questions;
}

// Build step execution
const rootDir = process.cwd();
const mdPath = path.join(rootDir, "data", "kramix-question-bank.md");
const fallbackMdPath = path.join(rootDir, "kramix-question-bank.md");

const actualMdPath = fs.existsSync(mdPath) ? mdPath : fallbackMdPath;

if (fs.existsSync(actualMdPath)) {
  const content = fs.readFileSync(actualMdPath, "utf-8");
  const parsed = parseQuestionBankMarkdown(content);
  const outPath = path.join(rootDir, "src", "lib", "demo", "question-bank-data.json");

  const dataMdPath = path.join(rootDir, "data", "kramix-question-bank.md");
  fs.mkdirSync(path.dirname(dataMdPath), { recursive: true });
  fs.writeFileSync(dataMdPath, content, "utf-8");

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), "utf-8");
  console.log(`[build-question-bank] Successfully parsed ${parsed.length} questions into ${outPath}`);
} else {
  console.error(`[build-question-bank] Markdown file not found at ${actualMdPath}`);
  process.exit(1);
}
