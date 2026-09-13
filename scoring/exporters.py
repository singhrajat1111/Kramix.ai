"""
Multi-Format Exporters for Kramix V2 Final Interview Reports.
Renders FinalInterviewReport instances into JSON, Markdown, and HTML dossiers.

CRITICAL PRINCIPLES:
1. One Report Model: All exporters render the exact same FinalInterviewReport data structure.
2. No hidden heuristics or divergent calculations per format.
3. Clean, professional presentation suitable for hiring committee review and compliance audits.
"""
from __future__ import annotations
import json
from typing import Any, Dict
from schemas.report import FinalInterviewReport


def export_json(report: FinalInterviewReport, indent: int = 2) -> str:
    """
    Serializes a FinalInterviewReport into clean, formatted JSON.
    """
    return report.model_dump_json(indent=indent)


def export_markdown(report: FinalInterviewReport) -> str:
    """
    Generates a structured, human-readable Markdown dossier for hiring committee review.
    """
    s_info = report.session_info
    metrics = report.performance_metrics
    assessment = report.hiring_assessment

    rec_name = getattr(assessment.recommendation, "value", str(assessment.recommendation)).upper()

    lines = [
        f"# KRAMIX INTERVIEW EVALUATION DOSSIER",
        f"**Session ID:** `{s_info.session_id}`  |  **Mode:** `{s_info.mode}`  |  **Status:** `{s_info.completion_status}`",
        f"**Role / Domain:** {s_info.role or 'General'}  |  **Questions Answered:** {s_info.total_questions_answered}/{s_info.total_questions_asked}",
        "",
        "---",
        "",
        "## 1. EXECUTIVE SUMMARY & HIRING COMMITTEE RECOMMENDATION",
        "",
        f"### Recommendation: **{rec_name}** (Confidence: {assessment.confidence * 100:.0f}%)",
        f"> {assessment.summary}",
        "",
        f"**Overall Normalized Score:** `{metrics.overall_score:.1f} / 100.0`",
        "",
        report.executive_summary,
        "",
        "#### Key Risks / Caveats",
    ]
    for risk in assessment.key_risks:
        lines.append(f"- ⚠️ {risk}")
    for cav in assessment.caveats:
        lines.append(f"- ℹ️ {cav}")

    lines.extend([
        "",
        "---",
        "",
        "## 2. EVALUATED COMPETENCY DIMENSIONS",
        "",
        "| Competency Dimension | Internal (0-1) | Report Score (0-100) | Questions Evaluated | Notes |",
        "| :--- | :---: | :---: | :---: | :--- |",
    ])

    for dim_key, dim in metrics.dimension_breakdown.items():
        lines.append(
            f"| **{dim.name}** | `{dim.internal_score:.3f}` | `{dim.report_score:.1f}` | {dim.evidence_count} | {dim.summary} |"
        )

    # Note on decoupled confidence
    if metrics.confidence_score is not None:
        lines.extend([
            "",
            f"**Candidate Confidence Indicator:** `{metrics.confidence_score:.1f} / 100.0`",
            "*Note: In accordance with Kramix architectural standards, candidate confidence is tracked as an independent behavioral indicator and is never multiplied into technical correctness.*",
        ])

    lines.extend([
        "",
        "---",
        "",
        "## 3. KEY STRENGTHS & CONCEPT GAPS",
        "",
        "### Key Strengths",
    ])
    for s in report.key_strengths:
        lines.append(f"- ✅ {s}")

    lines.extend([
        "",
        "### Structured Concept Gaps",
    ])
    if report.concept_gaps:
        lines.extend([
            "| Concept | Severity | Affected Questions | Evidence & Guidance |",
            "| :--- | :---: | :---: | :--- |",
        ])
        for g in report.concept_gaps:
            q_links = ", ".join(f"`{qid}`" for qid in g.affected_questions)
            lines.append(
                f"| **{g.concept}** | `{g.severity.upper()}` | {q_links} | {g.evidence} *Direction:* {g.recommended_learning_direction} |"
            )
    else:
        lines.append("No critical concept gaps identified.")

    # Contradictions section
    if report.contradictions:
        lines.extend([
            "",
            "### Observed Inconsistencies across Turns",
            "*Note: Inconsistencies are documented for factual reconciliation and do not imply intentional dishonesty.*",
            "",
            "| Fact Slot | Earlier Claim (Turn) | Later Claim (Turn) | Evidence |",
            "| :--- | :--- | :--- | :--- |",
        ])
        for c in report.contradictions:
            lines.append(
                f"| `{c.slot}` | \"{c.earlier_value}\" (Turn {c.earlier_turn}) | \"{c.later_value}\" (Turn {c.later_turn}) | {c.evidence} |"
            )

    # Round-level breakdown
    lines.extend([
        "",
        "---",
        "",
        "## 4. ROUND-LEVEL RESULTS",
        "",
    ])
    for r in report.round_reports:
        lines.extend([
            f"### Round: `{r.round.upper()}` (Score: {r.round_score:.1f}/100)",
            f"- **Questions Answered:** {r.questions_answered}",
            f"- **Completion Reason:** {r.completion_reason}",
            f"- **Concepts Covered:** {', '.join(r.concepts_covered) if r.concepts_covered else 'None'}",
            f"- **Concepts Omitted:** {', '.join(r.concepts_missing) if r.concepts_missing else 'None'}",
            f"- **Round Strengths:** {'; '.join(r.strengths)}",
            f"- **Round Weaknesses:** {'; '.join(r.weaknesses)}",
            "",
        ])

    # Detailed question performance log
    lines.extend([
        "---",
        "",
        "## 5. QUESTION-LEVEL AUDIT LOG",
        "",
    ])
    for qp in report.question_performances:
        status_badges = []
        if qp.is_dont_know:
            status_badges.append("⚠️ [Explicit Knowledge Gap / 'I Don't Know']")
        if qp.injection_detected:
            status_badges.append("🛡️ [Prompt Injection Neutralized]")

        status_str = f" {' '.join(status_badges)}" if status_badges else ""

        lines.extend([
            f"### Turn {qp.turn}: `{qp.question_id}` ({qp.round.upper()}){status_str}",
            f"**Question:** {qp.question_text}",
            f"**Candidate Answer:** *\"{qp.candidate_answer}\"*",
            "",
            f"- **Correctness:** `{qp.correctness * 100:.1f}%` | **Depth:** `{qp.depth * 100:.1f}%` | **Clarity:** `{qp.clarity * 100:.1f}%`",
            f"- **Concepts Covered:** {', '.join(qp.covered_concepts) if qp.covered_concepts else '(none)'}",
            f"- **Concepts Missing:** {', '.join(qp.missing_concepts) if qp.missing_concepts else '(none)'}",
            f"- **Engine Decision:** `{qp.decision_action or 'N/A'}` — *{qp.decision_reason or 'None'}*",
            "",
        ])

    return "\n".join(lines)


def export_html(report: FinalInterviewReport) -> str:
    """
    Renders a semantic, standalone HTML report styled with a clean corporate palette.
    """
    s_info = report.session_info
    metrics = report.performance_metrics
    assessment = report.hiring_assessment

    rec_val = getattr(assessment.recommendation, "value", str(assessment.recommendation)).lower()
    rec_color_map = {
        "strong_yes": "#0d9488",
        "yes": "#16a34a",
        "mixed": "#d97706",
        "no": "#dc2626",
        "insufficient_evidence": "#64748b",
    }
    rec_color = rec_color_map.get(rec_val, "#334155")
    rec_badge_text = rec_val.upper()

    dims_rows = ""
    for dim_key, dim in metrics.dimension_breakdown.items():
        dims_rows += f"""
        <tr>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-weight:600;">{dim.name}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:center;"><code>{dim.internal_score:.3f}</code></td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:center; font-weight:700;">{dim.report_score:.1f}%</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:center;">{dim.evidence_count}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">{dim.summary}</td>
        </tr>
        """

    gaps_rows = ""
    for g in report.concept_gaps:
        q_links = ", ".join(f"<code>{qid}</code>" for qid in g.affected_questions)
        sev_color = "#dc2626" if g.severity == "high" else "#d97706"
        gaps_rows += f"""
        <tr>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-weight:600;">{g.concept}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:center;"><span style="color:{sev_color}; font-weight:bold;">{g.severity.upper()}</span></td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:center;">{q_links}</td>
            <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">{g.evidence} <br/><em>Direction: {g.recommended_learning_direction}</em></td>
        </tr>
        """

    questions_html = ""
    for qp in report.question_performances:
        badges = []
        if qp.is_dont_know:
            badges.append("<span style='background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600;'>Explicit Knowledge Gap</span>")
        if qp.injection_detected:
            badges.append("<span style='background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600;'>Prompt Injection Neutralized</span>")
        badge_html = " " + " ".join(badges) if badges else ""

        questions_html += f"""
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <h4 style="margin:0; font-size:15px; color:#1e293b;">Turn {qp.turn}: <code>{qp.question_id}</code> ({qp.round.upper()}){badge_html}</h4>
                <div style="font-weight:700; color:#0f172a;">Score: {qp.correctness * 100:.1f}%</div>
            </div>
            <p style="margin:4px 0 8px 0; font-weight:500; color:#334155;"><strong>Question:</strong> {qp.question_text}</p>
            <p style="margin:4px 0 12px 0; font-style:italic; color:#475569; background:#ffffff; padding:10px; border-left:3px solid #cbd5e1; border-radius:4px;">"{qp.candidate_answer}"</p>
            <div style="font-size:13px; color:#64748b; line-height:1.6;">
                <div><strong>Concepts Covered:</strong> {', '.join(qp.covered_concepts) if qp.covered_concepts else '(none)'}</div>
                <div><strong>Concepts Missing:</strong> {', '.join(qp.missing_concepts) if qp.missing_concepts else '(none)'}</div>
                <div><strong>Decision Action:</strong> <code>{qp.decision_action or 'N/A'}</code> — <em>{qp.decision_reason or 'None'}</em></div>
            </div>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kramix Interview Dossier - {s_info.session_id}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a; margin: 0; padding: 24px; }}
        .container {{ max-width: 960px; margin: 0 auto; background: #ffffff; padding: 36px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
        h1, h2, h3, h4 {{ color: #0f172a; }}
        .badge-rec {{ display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 15px; color: #ffffff; background-color: {rec_color}; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
        th {{ background: #f8fafc; padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 13px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }}
        code {{ background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: monospace; color: #0f172a; }}
    </style>
</head>
<body>
    <div class="container">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #e2e8f0; padding-bottom:16px;">
            <div>
                <h1 style="margin:0 0 8px 0; font-size:24px;">Kramix Interview Evaluation Dossier</h1>
                <div style="color:#64748b; font-size:14px;">
                    Session: <code>{s_info.session_id}</code> | Mode: <strong>{s_info.mode.upper()}</strong> | Role: <strong>{s_info.role or 'General'}</strong>
                </div>
            </div>
            <div style="text-align:right;">
                <div class="badge-rec">{rec_badge_text}</div>
                <div style="font-size:12px; color:#64748b; margin-top:4px;">Confidence: {assessment.confidence * 100:.0f}%</div>
            </div>
        </div>

        <section style="margin-top:24px;">
            <h2>Executive Summary</h2>
            <div style="background:#f8fafc; border-left:4px solid {rec_color}; padding:16px; border-radius:6px; font-size:15px; line-height:1.6;">
                {report.executive_summary}
            </div>
            <p style="margin-top:12px; font-size:14px; color:#475569;">
                <strong>Overall Normalized Performance:</strong> <span style="font-size:18px; font-weight:700; color:#0f172a;">{metrics.overall_score:.1f}%</span>
            </p>
        </section>

        <section style="margin-top:32px;">
            <h2>Competency Dimensions</h2>
            <table>
                <thead>
                    <tr>
                        <th>Dimension</th>
                        <th style="text-align:center;">Internal (0-1)</th>
                        <th style="text-align:center;">Report Score</th>
                        <th style="text-align:center;">Count</th>
                        <th>Summary</th>
                    </tr>
                </thead>
                <tbody>
                    {dims_rows}
                </tbody>
            </table>
        </section>

        <section style="margin-top:32px;">
            <h2>Concept Gaps & Growth Areas</h2>
            {f"<table><thead><tr><th>Concept</th><th style='text-align:center;'>Severity</th><th style='text-align:center;'>Questions</th><th>Evidence</th></tr></thead><tbody>{gaps_rows}</tbody></table>" if report.concept_gaps else "<p style='color:#64748b;'>No critical concept gaps identified during session.</p>"}
        </section>

        <section style="margin-top:32px;">
            <h2>Question-Level Audit Trail</h2>
            {questions_html}
        </section>
    </div>
</body>
</html>
"""
    return html
