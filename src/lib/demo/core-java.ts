/**
 * Kramix.AI — Core Java Question Bank & Domain Engine
 *
 * Dedicated domain module for Core Java fundamentals.
 * Strictly excludes frameworks (Spring, Spring Boot, Hibernate, JPA, JDBC, Servlets, JSP, etc.).
 *
 * Requirements:
 * - Exactly 10 canonical Core Java questions.
 * - Randomly select 5 unique questions from these 10 for an interview session.
 * - Never repeat questions within the same session.
 * - Case-insensitive domain detection on role, skills, job description, and resume.
 */

import { AIGeneratedQuestion } from "@/types/ai-question";
import { DemoQuestion } from "./question-bank";

export interface CoreJavaQuestionDefinition {
  id: string;
  number: number;
  question: string;
  answer: string;
  keyPoints: string[];
}

export const CORE_JAVA_10_QUESTIONS: readonly CoreJavaQuestionDefinition[] = [
  {
    id: "core_java_q1",
    number: 1,
    question: "What is Java?",
    answer:
      "Java is a high-level, object-oriented, class-based programming language designed to be platform independent. Java code is compiled into bytecode, which can run on any system having a compatible JVM.",
    keyPoints: [
      "High-level, object-oriented, and class-based language",
      "Platform independence through compilation to bytecode",
      "Runs on any system with a compatible JVM (Write Once, Run Anywhere)",
    ],
  },
  {
    id: "core_java_q2",
    number: 2,
    question: "What is the difference between JDK, JRE, and JVM?",
    answer:
      "JVM (Java Virtual Machine): Executes Java bytecode.\nJRE (Java Runtime Environment): Contains the JVM and libraries required to run Java applications.\nJDK (Java Development Kit): Contains the JRE plus development tools such as the Java compiler (javac).\n\nSimple hierarchy: JDK → JRE → JVM",
    keyPoints: [
      "JVM executes Java bytecode",
      "JRE contains JVM plus core libraries needed for runtime execution",
      "JDK contains JRE plus development tools like javac",
      "Hierarchy: JDK → JRE → JVM",
    ],
  },
  {
    id: "core_java_q3",
    number: 3,
    question: "What are the main features of Java?",
    answer:
      "Important features of Java include: Object-oriented, Platform independent, Portable, Robust, Secure, Multithreaded, Automatic garbage collection, and High performance through JIT compilation.",
    keyPoints: [
      "Object-oriented and platform independent",
      "Portable and robust architecture",
      "Secure and multithreaded",
      "Automatic garbage collection",
      "High performance with JIT (Just-In-Time) compiler",
    ],
  },
  {
    id: "core_java_q4",
    number: 4,
    question: "What is a class and what is an object in Java?",
    answer:
      "A class is a blueprint that defines properties and behaviors.\nAn object is an actual instance of a class.\n\nExample:\nclass Car {\n    String color;\n}\nCar c1 = new Car();\n\nHere, Car is the class and c1 is an object.",
    keyPoints: [
      "Class serves as a blueprint or template defining fields and methods",
      "Object is a concrete instance of a class allocated in memory",
      "Objects are instantiated using the 'new' keyword",
    ],
  },
  {
    id: "core_java_q5",
    number: 5,
    question: "What are the four pillars of OOP in Java?",
    answer:
      "The four main pillars of Object-Oriented Programming are:\n1. Encapsulation — wrapping data and methods together.\n2. Inheritance — acquiring properties and behavior from another class.\n3. Polymorphism — one interface/name having multiple forms.\n4. Abstraction — hiding implementation details and showing essential functionality.",
    keyPoints: [
      "Encapsulation: Bundling data and methods, data hiding with private fields",
      "Inheritance: Code reusability via superclasses and subclasses",
      "Polymorphism: Method overloading and method overriding",
      "Abstraction: Exposing interface while hiding internal implementation details",
    ],
  },
  {
    id: "core_java_q6",
    number: 6,
    question: "What is the difference between == and .equals() in Java?",
    answer:
      "== compares primitive values directly, but for objects it generally compares whether two references point to the same object.\n\n.equals() is used to compare object contents when the class provides an appropriate implementation.\n\nExample:\nString a = new String(\"Java\");\nString b = new String(\"Java\");\na == b        // false\na.equals(b)   // true",
    keyPoints: [
      "== compares memory reference addresses for objects (identity)",
      ".equals() evaluates logical equivalence or content of objects",
      "Classes like String, Integer, and custom classes override .equals() for value equality",
    ],
  },
  {
    id: "core_java_q7",
    number: 7,
    question: "What is method overloading in Java?",
    answer:
      "Method overloading means having multiple methods with the same name but different parameter lists in the same class.\n\nExample:\nvoid add(int a, int b) {}\nvoid add(int a, int b, int c) {}\n\nIt is an example of compile-time polymorphism.",
    keyPoints: [
      "Multiple methods with identical name in the same class",
      "Must have different parameter lists (type, count, or order)",
      "Resolved at compile-time (static polymorphism)",
      "Return type alone cannot differentiate overloaded methods",
    ],
  },
  {
    id: "core_java_q8",
    number: 8,
    question: "What is method overriding in Java?",
    answer:
      "Method overriding occurs when a child class provides its own implementation of a method already defined in its parent class.\n\nExample:\nclass Animal {\n    void sound() {\n        System.out.println(\"Animal sound\");\n    }\n}\nclass Dog extends Animal {\n    @Override\n    void sound() {\n        System.out.println(\"Bark\");\n    }\n}\n\nIt is associated with runtime polymorphism.",
    keyPoints: [
      "Child class redefines a method declared in its superclass",
      "Method signature and return type must match parent method",
      "Resolved dynamically at runtime (dynamic method dispatch)",
      "Uses @Override annotation for compile-time verification",
    ],
  },
  {
    id: "core_java_q9",
    number: 9,
    question: "What is the difference between an interface and an abstract class?",
    answer:
      "An abstract class can contain abstract methods as well as concrete methods and can have instance variables and constructors.\n\nAn interface defines a contract that classes can implement. Modern Java interfaces can also contain default and static methods.\n\nA class can implement multiple interfaces, while Java allows a class to extend only one class.",
    keyPoints: [
      "Abstract class can have constructors and instance fields; interfaces have public static final constants",
      "A class can extend only one abstract class but implement multiple interfaces",
      "Interfaces declare contracts and support default/static methods in Java 8+",
      "Abstract classes represent 'is-a' relationships; interfaces represent capabilities",
    ],
  },
  {
    id: "core_java_q10",
    number: 10,
    question: "What is garbage collection in Java?",
    answer:
      "Garbage collection is Java's automatic memory-management mechanism.\n\nThe JVM identifies objects that are no longer reachable and can reclaim their memory automatically.\n\nThis reduces the need for programmers to manually free memory.",
    keyPoints: [
      "Automatic heap memory deallocation managed by JVM",
      "Reclaims memory occupied by unreachable objects with no active references",
      "Eliminates manual memory management and dangling pointers",
      "Uses algorithms such as mark-and-sweep, generational GC",
    ],
  },
] as const;

/**
 * Regex matching "Core Java" with case-insensitivity and word boundaries.
 * Correctly matches:
 *  - "Core Java"
 *  - "core java"
 *  - "CORE JAVA"
 *  - "Core Java Developer"
 *  - "Skills: Core Java, OOP, SQL"
 * Does NOT match "Hibernate Developer", "Spring Developer", etc.
 */
const CORE_JAVA_REGEX = /\bcore\s+java\b/i;

export interface SkillDetectionInput {
  targetRole?: string | null;
  skills?: string[] | null;
  jobDescription?: string | null;
  resumeText?: string | null;
  additionalContext?: string | null;
}

/**
 * Checks whether Core Java domain is activated based on role, skills, job description, or resume.
 */
export function isCoreJavaDomain(input: SkillDetectionInput | string | null | undefined): boolean {
  if (!input) return false;

  if (typeof input === "string") {
    return CORE_JAVA_REGEX.test(input);
  }

  if (input.targetRole && CORE_JAVA_REGEX.test(input.targetRole)) {
    return true;
  }

  if (Array.isArray(input.skills)) {
    for (const skill of input.skills) {
      if (typeof skill === "string" && CORE_JAVA_REGEX.test(skill)) {
        return true;
      }
    }
  }

  if (input.jobDescription && CORE_JAVA_REGEX.test(input.jobDescription)) {
    return true;
  }

  if (input.resumeText && CORE_JAVA_REGEX.test(input.resumeText)) {
    return true;
  }

  if (input.additionalContext && CORE_JAVA_REGEX.test(input.additionalContext)) {
    return true;
  }

  return false;
}

/**
 * Fisher-Yates unbiased shuffle.
 */
function shuffleArray<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Selects 5 unique questions from the 10 Core Java questions using Fisher-Yates randomization.
 * Never repeats a question in the same session.
 *
 * @param count Number of questions to pick (default 5)
 * @param excludeQuestions Array of question text strings to exclude for deduplication
 */
export function getRandomCoreJavaQuestions(
  count = 5,
  excludeQuestions: string[] = []
): CoreJavaQuestionDefinition[] {
  const excludeSet = new Set(excludeQuestions.map((q) => q.trim().toLowerCase()));

  // Filter out any already asked questions
  const available = CORE_JAVA_10_QUESTIONS.filter(
    (q) => !excludeSet.has(q.question.trim().toLowerCase())
  );

  // If available questions are fewer than count (e.g. late in session), fall back to all questions
  const pool = available.length >= count ? available : [...CORE_JAVA_10_QUESTIONS];

  const shuffled = shuffleArray(pool);
  return shuffled.slice(0, count);
}

/**
 * Converts Core Java questions into the DemoQuestion format used by the question bank.
 */
export function getCoreJavaDemoQuestions(
  count = 5,
  excludeQuestions: string[] = []
): DemoQuestion[] {
  const selected = getRandomCoreJavaQuestions(count, excludeQuestions);
  return selected.map((q) => ({
    role: "Core Java",
    category: "technical" as const,
    question: q.question,
    keyPoints: [...q.keyPoints],
  }));
}

/**
 * Converts Core Java questions into the AIGeneratedQuestion format for AI/full interview mode.
 * Preserves model answers in expectedAnswer and evaluationPoints, strictly assessing Core Java fundamentals.
 */
export function getCoreJavaAIQuestions(
  count = 5,
  previousQuestions: string[] = []
): AIGeneratedQuestion[] {
  const selected = getRandomCoreJavaQuestions(count, previousQuestions);
  return selected.map((q) => ({
    id: q.id,
    question: q.question,
    topic: "Core Java",
    difficulty: "medium" as const,
    type: "conceptual" as const,
    expectedAnswer: q.answer,
    evaluationPoints: [...q.keyPoints],
    sourceContext: ["Core Java Question Bank"],
  }));
}
