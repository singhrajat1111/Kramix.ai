"""
Observability audit exporter.
Exports structured session traces into human-readable Markdown audit reports and JSON timelines.
Fulfills non-negotiable rule #7: complete transparency on why every decision and score was made.
"""
from __future__ import annotations
import json
from typing import Dict, List
from observability.trace import SessionTrace, TraceEventType


def format_markdown_audit(trace: SessionTrace) -> str:
    """
    Formats a SessionTrace into a clean Markdown audit document detailing
    every question chosen, score assigned, and decision transition.
    """
    events = trace.get_timeline()
    if not events:
        return f"# Interview Session Audit: {trace.session_id}\n\n*No events recorded for this session.*"

    lines: List[str] = [
        f"# Interview Decision & Observability Audit: `{trace.session_id}`",
        "",
        "> This audit trail records every automated decision, score derivation, and state transition",
        "> executed by the Kramix V2 decision engine with human-readable justifications.",
        "",
        "---",
        "",
        "## Timeline of Events",
        "",
    ]

    # Group events by turn
    by_turn: Dict[int, list] = {}
    for event in events:
        turn = event.turn
        if turn not in by_turn:
            by_turn[turn] = []
        by_turn[turn].append(event)

    for turn in sorted(by_turn.keys()):
        turn_label = f"Turn {turn}" if turn > 0 else "Session Initialization (Turn 0)"
        lines.append(f"### {turn_label}")
        lines.append("")

        for e in by_turn[turn]:
            event_type = str(e.event_type).replace("_", " ").title()
            lines.append(f"- **[{event_type}]**: {e.reason}")

            if e.metadata:
                meta_items = [f"`{k}`: {v}" for k, v in e.metadata.items() if k not in {"question_text"}]
                if meta_items:
                    lines.append(f"  - *Details*: {', '.join(meta_items)}")

        lines.append("")

    # Summary section
    decisions = trace.get_decisions()
    questions = trace.get_questions()
    contradictions = trace.get_contradictions()

    lines.extend([
        "---",
        "",
        "## Executive Decision Summary",
        "",
        f"- **Total Questions Posed**: {len(questions)}",
        f"- **Total Engine Decisions**: {len(decisions)}",
        f"- **Contradictions Detected**: {len(contradictions)}",
        "",
        "### Key Decisions Breakdown",
        "",
    ])

    for idx, d in enumerate(decisions, 1):
        action = d.metadata.get("action", "unknown").upper()
        lines.append(f"{idx}. **Action: `{action}`** — {d.reason}")

    if contradictions:
        lines.extend([
            "",
            "### Contradiction Flags",
            "",
        ])
        for c in contradictions:
            slot = c.metadata.get("slot", "unknown")
            lines.append(f"- Slot `{slot}`: {c.reason}")

    return "\n".join(lines)


def format_json_trace(trace: SessionTrace, indent: int = 2) -> str:
    """
    Exports the SessionTrace as a formatted JSON string.
    """
    payload = {
        "session_id": trace.session_id,
        "total_events": len(trace.get_timeline()),
        "events": trace.to_dict_list(),
    }
    return json.dumps(payload, indent=indent)
