"use client";

import React, { useState } from "react";
import { InterviewReport } from "@/types/evaluation";
import { HiringCommitteeDossier } from "@/types/session";
import {
  Download,
  FileText,
  Printer,
  Copy,
  Check,
  Code,
  X,
} from "lucide-react";

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: InterviewReport | null;
  dossier: HiringCommitteeDossier | null;
}

export function ReportExportModal({
  isOpen,
  onClose,
  report,
  dossier,
}: ReportExportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const roleName = dossier?.targetRole || report?.targetRole || "Software Engineer";
  const companyName = dossier?.targetCompany || report?.targetCompany || "Target Company";
  const dateStr = new Date(dossier?.generatedAt || report?.timestamp || Date.now()).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fileSafeDate = new Date().toISOString().slice(0, 10);
  const filePrefix = `kramix-report-${roleName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${fileSafeDate}`;

  // 1. Download Markdown (.md)
  const handleDownloadMarkdown = () => {
    const md = buildMarkdownContent(report, dossier, roleName, companyName, dateStr);
    downloadBlob(md, `${filePrefix}.md`, "text/markdown;charset=utf-8;");
  };

  // 2. Download JSON (.json)
  const handleDownloadJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      platform: "Kramix AI (https://kramix.ai)",
      targetRole: roleName,
      targetCompany: companyName,
      dossier: dossier || null,
      roundReport: report || null,
    };
    downloadBlob(JSON.stringify(data, null, 2), `${filePrefix}.json`, "application/json;charset=utf-8;");
  };

  // 3. Print / Save as PDF
  const handlePrint = () => {
    onClose();
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.print();
      }
    }, 250);
  };

  // 4. Copy Summary
  const handleCopySummary = async () => {
    const summary = buildExecutiveSummaryText(report, dossier, roleName, companyName, dateStr);
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = summary;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 no-print">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0d121d] p-6 shadow-2xl text-slate-100 space-y-6">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-[11px] font-semibold text-brand-300">
            <Download className="h-3 w-3" />
            <span>Export & Share</span>
          </div>
          <h2 className="text-xl font-bold text-white">Export Interview Evaluation</h2>
          <p className="text-xs text-slate-400">
            Download your performance evaluation for {roleName} at {companyName}.
          </p>
        </div>

        {/* Export Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Option 1: PDF / Print */}
          <button
            type="button"
            onClick={handlePrint}
            className="group flex flex-col items-start p-4 rounded-xl border border-slate-800 bg-surface-100 hover:bg-surface-200 hover:border-brand-500/50 transition-all text-left"
          >
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 mb-3 group-hover:scale-110 transition-transform">
              <Printer className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-white">Print or Save PDF</span>
            <span className="text-[11px] text-slate-400 mt-1 leading-snug">
              Formatted print view. Select &quot;Save as PDF&quot; in destination.
            </span>
          </button>

          {/* Option 2: Markdown (.md) */}
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="group flex flex-col items-start p-4 rounded-xl border border-slate-800 bg-surface-100 hover:bg-surface-200 hover:border-emerald-500/50 transition-all text-left"
          >
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mb-3 group-hover:scale-110 transition-transform">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-white">Download Markdown</span>
            <span className="text-[11px] text-slate-400 mt-1 leading-snug">
              Full debrief with questions, answers, criteria, and roadmap.
            </span>
          </button>

          {/* Option 3: Copy Summary */}
          <button
            type="button"
            onClick={handleCopySummary}
            className="group flex flex-col items-start p-4 rounded-xl border border-slate-800 bg-surface-100 hover:bg-surface-200 hover:border-sky-500/50 transition-all text-left"
          >
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mb-3 group-hover:scale-110 transition-transform">
              {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
            </div>
            <span className="text-sm font-semibold text-white">
              {copied ? "Copied to Clipboard!" : "Copy Summary"}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 leading-snug">
              Key takeaways, scores, and recommendations ready to share.
            </span>
          </button>

          {/* Option 4: Raw JSON */}
          <button
            type="button"
            onClick={handleDownloadJSON}
            className="group flex flex-col items-start p-4 rounded-xl border border-slate-800 bg-surface-100 hover:bg-surface-200 hover:border-amber-500/50 transition-all text-left"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 mb-3 group-hover:scale-110 transition-transform">
              <Code className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-white">Structured JSON</span>
            <span className="text-[11px] text-slate-400 mt-1 leading-snug">
              Full machine-readable data for engineering tracking.
            </span>
          </button>
        </div>

        {/* Footer Note */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span>Kramix AI · Realistic Mock Interviews</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildExecutiveSummaryText(
  report: InterviewReport | null,
  dossier: HiringCommitteeDossier | null,
  role: string,
  company: string,
  date: string
): string {
  const lines: string[] = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `KRAMIX AI — INTERVIEW EVALUATION SUMMARY`,
    `Role: ${role} | Target: ${company}`,
    `Date: ${date}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ];

  if (dossier) {
    lines.push(`\nHIRING COMMITTEE VERDICT: ${dossier.finalRecommendation}`);
    lines.push(`Composite Score: ${dossier.scorecard.compositeScore}/100`);
    if (dossier.narrative?.executiveAssessment) {
      lines.push(`\nExecutive Assessment:\n${dossier.narrative.executiveAssessment}`);
    }
  } else if (report) {
    lines.push(`\nOVERALL SCORE: ${report.overallScore}/100 (${report.roundName})`);
    lines.push(`Duration: ${report.durationMinutes} minutes`);
    lines.push(`\nScoring Breakdown:`);
    lines.push(`• Communication: ${report.scoringBreakdown.communication}/100`);
    lines.push(`• Technical Knowledge: ${report.scoringBreakdown.technicalKnowledge}/100`);
    lines.push(`• Problem Solving: ${report.scoringBreakdown.problemSolving}/100`);
    lines.push(`• Role Relevance: ${report.scoringBreakdown.roleRelevance}/100`);
  }

  const strengths = dossier?.narrative?.strengths || report?.strengths;
  if (strengths && strengths.length > 0) {
    lines.push(`\nKey Strengths:`);
    strengths.forEach((s) => lines.push(`✓ ${s}`));
  }

  const concerns = dossier?.narrative?.concerns || report?.weaknesses;
  if (concerns && concerns.length > 0) {
    lines.push(`\nAreas for Improvement:`);
    concerns.forEach((w) => lines.push(`• ${w}`));
  }

  if (report?.actionablePlan?.keyTakeaway) {
    lines.push(`\nKey Takeaway:`);
    lines.push(report.actionablePlan.keyTakeaway);
  }

  lines.push(`\nGenerated by Kramix AI (https://kramix.ai)`);
  return lines.join("\n");
}

function buildMarkdownContent(
  report: InterviewReport | null,
  dossier: HiringCommitteeDossier | null,
  role: string,
  company: string,
  date: string
): string {
  const parts: string[] = [];

  parts.push(`# Interview Performance Evaluation — ${role}`);
  parts.push(`**Target Company**: ${company}  `);
  parts.push(`**Date**: ${date}  `);
  parts.push(`**Generated by**: [Kramix AI](https://kramix.ai)  \n---`);

  // Dossier Section
  if (dossier) {
    parts.push(`## Hiring Committee Dossier`);
    parts.push(`**Final Recommendation**: \`${dossier.finalRecommendation}\`  `);
    parts.push(`**Composite Score**: **${dossier.scorecard.compositeScore}/100**  `);
    if (dossier.experienceLevel) {
      parts.push(`**Experience Level**: ${dossier.experienceLevel}  `);
    }
    if (dossier.narrative?.executiveAssessment) {
      parts.push(`\n### Executive Assessment\n${dossier.narrative.executiveAssessment}\n`);
    }

    parts.push(`### Competency Breakdown`);
    parts.push(`| Competency | Score |`);
    parts.push(`| :--- | :---: |`);
    if (dossier.scorecard.communication !== undefined) {
      parts.push(`| Communication | ${dossier.scorecard.communication}/100 |`);
    }
    if (dossier.scorecard.technicalCompetency !== undefined) {
      parts.push(`| Technical Mastery | ${dossier.scorecard.technicalCompetency}/100 |`);
    }
    if (dossier.scorecard.problemSolving !== undefined) {
      parts.push(`| Problem Solving | ${dossier.scorecard.problemSolving}/100 |`);
    }
    if (dossier.scorecard.systemDesign !== undefined) {
      parts.push(`| System Architecture | ${dossier.scorecard.systemDesign}/100 |`);
    }
    if (dossier.scorecard.behavioral !== undefined) {
      parts.push(`| Leadership & Culture | ${dossier.scorecard.behavioral}/100 |`);
    }
    parts.push(``);

    if (dossier.roundPerformances?.length) {
      parts.push(`### Round-by-Round Breakdown`);
      dossier.roundPerformances.forEach((r) => {
        parts.push(`**Round ${r.roundNumber}: ${r.roundTitle}** (${r.score}/100)`);
        if (r.keyTakeaway) {
          parts.push(`> ${r.keyTakeaway}\n`);
        }
      });
    }
  }

  // Round Report Section
  if (report) {
    parts.push(`## ${report.roundName} — Detailed Debrief`);
    parts.push(`**Round Score**: **${report.overallScore}/100** | **Duration**: ${report.durationMinutes} mins\n`);

    parts.push(`### Sub-Score Breakdown`);
    parts.push(`| Dimension | Score |`);
    parts.push(`| :--- | :---: |`);
    parts.push(`| Technical Knowledge | ${report.scoringBreakdown.technicalKnowledge}/100 |`);
    parts.push(`| Communication & Clarity | ${report.scoringBreakdown.communication}/100 |`);
    parts.push(`| Problem Solving | ${report.scoringBreakdown.problemSolving}/100 |`);
    parts.push(`| Role Relevance | ${report.scoringBreakdown.roleRelevance}/100 |`);
    if (report.scoringBreakdown.confidenceAndClarity) {
      parts.push(`| Delivery & Confidence | ${report.scoringBreakdown.confidenceAndClarity}/100 |`);
    }
    parts.push(``);

    if (report.strengths?.length) {
      parts.push(`### Strengths Demonstrated`);
      report.strengths.forEach((s) => parts.push(`- ✅ ${s}`));
      parts.push(``);
    }

    if (report.weaknesses?.length) {
      parts.push(`### Areas to Sharpen`);
      report.weaknesses.forEach((w) => parts.push(`- ⚠️ ${w}`));
      parts.push(``);
    }

    // Question Review
    if (report.questionEvaluations?.length) {
      parts.push(`### Question-by-Question Analysis\n`);
      report.questionEvaluations.forEach((q, idx) => {
        parts.push(`#### Question ${idx + 1}: ${q.questionText}`);
        parts.push(`- **Score**: **${q.scoreOutOfTen}/10** | **Topic**: ${q.topicTag || "Technical"}`);
        parts.push(`\n**Your Response**:`);
        parts.push(`> ${q.candidateAnswer || "[No verbal response recorded]"}`);

        if (q.whatWentWell?.length) {
          parts.push(`\n**What Worked Well**:`);
          q.whatWentWell.forEach((item) => parts.push(`- ${item}`));
        }

        if (q.whatCouldImprove?.length) {
          parts.push(`\n**What Could Improve**:`);
          q.whatCouldImprove.forEach((item) => parts.push(`- ${item}`));
        }

        if (q.idealDirection) {
          parts.push(`\n**Ideal Direction / Key Points**:`);
          parts.push(`> ${q.idealDirection}`);
        }
        parts.push(`\n---`);
      });
    }

    // Actionable Roadmap
    if (report.actionablePlan) {
      parts.push(`\n### Actionable Preparation Roadmap`);
      parts.push(`**Overview**: ${report.actionablePlan.summary}\n`);

      if (report.actionablePlan.priorities?.length) {
        report.actionablePlan.priorities.forEach((p) => {
          parts.push(`#### Priority ${p.priorityNumber}: ${p.topic}`);
          parts.push(`**Why this matters**: ${p.reason}\n`);
          if (p.recommendedPractice?.length) {
            parts.push(`**Recommended Practice**:`);
            p.recommendedPractice.forEach((step) => parts.push(`- ${step}`));
          }
          if (p.suggestedQuestions?.length) {
            parts.push(`\n**Suggested Practice Questions**:`);
            p.suggestedQuestions.forEach((sq) => parts.push(`- *"${sq}"*`));
          }
          parts.push(``);
        });
      }

      if (report.actionablePlan.keyTakeaway) {
        parts.push(`> **Key Takeaway**: ${report.actionablePlan.keyTakeaway}`);
      }
    }
  }

  parts.push(`\n\n---\n*Report generated by Kramix AI — Realistic AI Interview Preparation Platform.*`);
  return parts.join("\n");
}
