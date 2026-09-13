"""
Final Report Engine and Hiring Committee Scoring Synthesis for Kramix V2.
Aggregates state machine, answer verdicts, decision traces, and candidate context
into a comprehensive, evidence-grounded FinalInterviewReport.

CRITICAL ARCHITECTURAL RULES:
1. Pure evidence aggregation: NEVER invents scores or acts as a second answer evaluator.
2. Scales: Internal scores are 0.0-1.0; report scores are normalized to 0.0-100.0.
3. Decoupled confidence: Confidence is tracked independently, never multiplied into correctness.
4. "I don't know" is recorded as self-awareness, not as an evaluation crash.
5. Inconsistencies are documented without judgmental accusations of dishonesty.
6. Transparent Hiring Committee assessment: outputs INSUFFICIENT_EVIDENCE when appropriate.
7. Zero live external dependencies for Demo Mode.
"""
from __future__ import annotations
from typing import Dict, List, Optional, Any, Set
import time

from schemas.interview_state import InterviewState, RoundType, SessionTurnResult
from schemas.evaluation import AnswerVerdict
from schemas.report import (
    FinalInterviewReport,
    SessionInfo,
    PerformanceMetrics,
    DimensionScore,
    QuestionPerformance,
    RoundReport,
    ConceptGap,
    ContradictionReport,
    HiringAssessment,
    HiringRecommendation,
)
from observability.trace import TraceLogger, TraceEvent, SessionTrace, global_tracer
from memory.candidate_context import CandidateContextMemory
from rounds.base_strategy import normalize_round_str


class ReportEngine:
    """
    Deterministic synthesis engine producing structured reports and dossier assessments.
    """

    def __init__(self, tracer: Optional[TraceLogger] = None):
        self.tracer = tracer or global_tracer

    def generate_report(
        self,
        state: InterviewState,
        turn_results: Optional[List[SessionTurnResult]] = None,
        verdicts: Optional[List[AnswerVerdict]] = None,
        candidate_context: Optional[CandidateContextMemory] = None,
        trace: Optional[SessionTrace] = None,
        duration_seconds: Optional[float] = None,
    ) -> FinalInterviewReport:
        """
        Generates a comprehensive, evidence-backed FinalInterviewReport.
        """
        self.tracer.record(
            TraceEvent(
                session_id=state.session_id,
                turn=state.current_turn,
                event_type="report_generation_started",
                reason=f"Generating final interview report for session {state.session_id} (mode={state.mode})",
                metadata={"total_turns": state.current_turn, "mode": state.mode},
            )
        )

        try:
            # 1. Gather verdicts and turn mappings
            extracted_verdicts: List[AnswerVerdict] = []
            if turn_results:
                for tr in turn_results:
                    if tr.verdict and isinstance(tr.verdict, AnswerVerdict):
                        extracted_verdicts.append(tr.verdict)
            elif verdicts:
                extracted_verdicts = verdicts

            # 2. Build Question Performances
            question_performances = self._build_question_performances(
                state=state,
                turn_results=turn_results,
                verdicts=extracted_verdicts,
            )

            # 3. Calculate Normalized Performance Metrics
            metrics = self._calculate_metrics(question_performances)

            # 4. Synthesize Concept Gaps
            concept_gaps = self._synthesize_concept_gaps(question_performances)

            # 5. Extract Evidence-Backed Strengths & Weaknesses
            strengths, weaknesses = self._extract_strengths_and_weaknesses(
                question_performances,
                concept_gaps,
                metrics,
            )

            # 6. Build Contradiction Reports
            contradiction_reports = self._build_contradiction_reports(state)

            # 7. Build Round Reports
            round_reports = self._build_round_reports(state, question_performances)

            # 8. Synthesize Transparent Hiring Assessment
            hiring_assessment = self._synthesize_hiring_assessment(
                state=state,
                metrics=metrics,
                question_performances=question_performances,
                concept_gaps=concept_gaps,
                contradictions=contradiction_reports,
                strengths=strengths,
                weaknesses=weaknesses,
            )

            rec_val = getattr(hiring_assessment.recommendation, "value", str(hiring_assessment.recommendation))
            self.tracer.record(
                TraceEvent(
                    session_id=state.session_id,
                    turn=state.current_turn,
                    event_type="hiring_assessment_generated",
                    reason=f"Synthesized hiring committee assessment: {rec_val} (confidence={hiring_assessment.confidence:.2f})",
                    metadata={
                        "recommendation": rec_val,
                        "overall_score": metrics.overall_score,
                    },
                )
            )

            # 9. Formulate Executive Summary
            executive_summary = self._generate_executive_summary(
                state=state,
                metrics=metrics,
                assessment=hiring_assessment,
                strengths=strengths,
                gaps=concept_gaps,
            )

            # 10. Assemble Session Information
            session_info = SessionInfo(
                session_id=state.session_id,
                mode=state.mode,
                role=state.current_topic,
                completion_status="completed" if state.current_state == "ROUND_COMPLETE" else "in_progress",
                total_questions_asked=len(state.question_history),
                total_questions_answered=len(question_performances),
                duration_seconds=duration_seconds,
            )

            report = FinalInterviewReport(
                session_info=session_info,
                performance_metrics=metrics,
                hiring_assessment=hiring_assessment,
                round_reports=round_reports,
                question_performances=question_performances,
                concept_gaps=concept_gaps,
                key_strengths=strengths,
                key_weaknesses=weaknesses,
                contradictions=contradiction_reports,
                executive_summary=executive_summary,
            )

            self.tracer.record(
                TraceEvent(
                    session_id=state.session_id,
                    turn=state.current_turn,
                    event_type="report_generation_completed",
                    reason=f"Final interview report generation completed successfully for {state.session_id}",
                    metadata={"overall_score": metrics.overall_score, "questions_audited": len(question_performances)},
                )
            )

            return report

        except Exception as exc:
            self.tracer.record(
                TraceEvent(
                    session_id=state.session_id,
                    turn=state.current_turn,
                    event_type="report_generation_failed",
                    reason=f"Report generation encountered unexpected error: {str(exc)}",
                    metadata={"error_type": type(exc).__name__},
                )
            )
            raise

    # -----------------------------------------------------------------------
    # Internal Builders & Synthesis Helpers
    # -----------------------------------------------------------------------

    def _build_question_performances(
        self,
        state: InterviewState,
        turn_results: Optional[List[SessionTurnResult]],
        verdicts: List[AnswerVerdict],
    ) -> List[QuestionPerformance]:
        performances: List[QuestionPerformance] = []

        # Map verdicts by index or turn
        for idx, asked in enumerate(state.question_history):
            verdict: Optional[AnswerVerdict] = None
            if idx < len(verdicts):
                verdict = verdicts[idx]

            decision_action = None
            decision_reason = None
            if idx < len(state.previous_decisions):
                decision_action = str(state.previous_decisions[idx].action)
                decision_reason = state.previous_decisions[idx].reason

            candidate_answer = verdict.raw_answer if verdict else "(no answer recorded)"
            correctness = verdict.correctness if verdict else 0.0
            depth = verdict.depth if verdict else 0.0
            relevance = verdict.relevance if verdict else 0.0
            completeness = verdict.completeness if verdict else 0.0
            clarity = verdict.clarity if verdict else 0.0
            confidence_sig = verdict.confidence_signal if verdict else None
            is_dont_know = verdict.is_dont_know if verdict else False
            injection = verdict.injection_detected if verdict else False
            covered = verdict.hit_concepts if verdict else []
            missing = verdict.missed_concepts if verdict else []
            explanation = getattr(verdict, "explanation", None) if verdict else None

            perf = QuestionPerformance(
                turn=asked.asked_at_turn,
                question_id=asked.question_id,
                question_text=asked.question_text,
                round=normalize_round_str(getattr(asked, "round", None) or state.round),
                topic=state.current_topic or "general",
                difficulty="foundational",  # default
                question_type="technical",
                candidate_answer=candidate_answer,
                correctness=correctness,
                depth=depth,
                relevance=relevance,
                completeness=completeness,
                clarity=clarity,
                confidence_signal=confidence_sig,
                is_dont_know=is_dont_know,
                injection_detected=injection,
                covered_concepts=covered,
                missing_concepts=missing,
                decision_action=decision_action,
                decision_reason=decision_reason,
                explanation=explanation,
            )
            performances.append(perf)

        return performances

    def _calculate_metrics(
        self,
        perfs: List[QuestionPerformance],
    ) -> PerformanceMetrics:
        if not perfs:
            return PerformanceMetrics(
                overall_score=0.0,
                technical_performance=0.0,
                conceptual_depth=0.0,
                relevance=0.0,
                completeness=0.0,
                communication=0.0,
                problem_solving=0.0,
            )

        n = len(perfs)
        mean_correctness = sum(p.correctness for p in perfs) / n
        mean_depth = sum(p.depth for p in perfs) / n
        mean_relevance = sum(p.relevance for p in perfs) / n
        mean_completeness = sum(p.completeness for p in perfs) / n
        mean_clarity = sum(p.clarity for p in perfs) / n

        # Decoupled confidence
        conf_signals = [p.confidence_signal for p in perfs if p.confidence_signal is not None]
        confidence_score = round(sum(conf_signals) / len(conf_signals) * 100.0, 1) if conf_signals else None

        # Dimensions normalized to 0-100 scale
        tech_score = round(mean_correctness * 100.0, 1)
        depth_score = round(mean_depth * 100.0, 1)
        rel_score = round(mean_relevance * 100.0, 1)
        comp_score = round(mean_completeness * 100.0, 1)

        # Communication uses structured combination: clarity (40%), relevance (30%), completeness (30%)
        comm_score = round((mean_clarity * 0.40 + mean_relevance * 0.30 + mean_completeness * 0.30) * 100.0, 1)

        # Problem solving uses applied / technical performance
        prob_score = round((mean_correctness * 0.60 + mean_depth * 0.40) * 100.0, 1)

        # Check if project round questions exist
        project_perfs = [p for p in perfs if p.round == "project"]
        project_score = round(sum(p.correctness for p in project_perfs) / len(project_perfs) * 100.0, 1) if project_perfs else None

        # Overall weighted composite (0-100)
        # Clearly documented weights: Technical (35%), Depth (25%), Problem Solving (20%), Communication (20%)
        if project_score is not None:
            overall = round(
                tech_score * 0.30 +
                project_score * 0.20 +
                depth_score * 0.20 +
                prob_score * 0.15 +
                comm_score * 0.15,
                1,
            )
        else:
            overall = round(
                tech_score * 0.35 +
                depth_score * 0.25 +
                prob_score * 0.20 +
                comm_score * 0.20,
                1,
            )

        dimension_breakdown = {
            "technical": DimensionScore(
                name="Technical Accuracy",
                internal_score=round(mean_correctness, 3),
                report_score=tech_score,
                evidence_count=n,
                summary=f"Evaluated across {n} technical questions.",
            ),
            "depth": DimensionScore(
                name="Conceptual Depth",
                internal_score=round(mean_depth, 3),
                report_score=depth_score,
                evidence_count=n,
                summary="Degree of architectural mechanisms and trade-offs articulated.",
            ),
            "communication": DimensionScore(
                name="Technical Communication",
                internal_score=round(comm_score / 100.0, 3),
                report_score=comm_score,
                evidence_count=n,
                summary="Clarity, structure, and direct relevance of verbal/written explanations.",
            ),
            "problem_solving": DimensionScore(
                name="Problem Decomposition",
                internal_score=round(prob_score / 100.0, 3),
                report_score=prob_score,
                evidence_count=n,
                summary="Application of engineering principles to practical problems.",
            ),
        }
        if project_score is not None:
            dimension_breakdown["project"] = DimensionScore(
                name="Project Architecture",
                internal_score=round(project_score / 100.0, 3),
                report_score=project_score,
                evidence_count=len(project_perfs),
                summary="Exploration of claimed system architectures, decisions, and trade-offs.",
            )

        return PerformanceMetrics(
            overall_score=overall,
            technical_performance=tech_score,
            conceptual_depth=depth_score,
            relevance=rel_score,
            completeness=comp_score,
            communication=comm_score,
            problem_solving=prob_score,
            project_knowledge=project_score,
            confidence_score=confidence_score,
            dimension_breakdown=dimension_breakdown,
        )

    def _synthesize_concept_gaps(
        self,
        perfs: List[QuestionPerformance],
    ) -> List[ConceptGap]:
        gap_map: Dict[str, List[str]] = {}

        for p in perfs:
            for c in p.missing_concepts:
                clean = c.strip().lower()
                if clean not in gap_map:
                    gap_map[clean] = []
                gap_map[clean].append(p.question_id)

        gaps: List[ConceptGap] = []
        for concept, qids in gap_map.items():
            severity = "high" if len(qids) >= 2 else "medium"
            gaps.append(
                ConceptGap(
                    concept=concept,
                    affected_questions=qids,
                    severity=severity,
                    evidence=f"Omitted or incomplete across {len(qids)} questions ({', '.join(qids)}).",
                    recommended_learning_direction=f"Review foundational principles, failure modes, and practical implementations of {concept}.",
                )
            )

        # Sort by severity (high first)
        gaps.sort(key=lambda g: 0 if g.severity == "high" else 1)
        return gaps

    def _extract_strengths_and_weaknesses(
        self,
        perfs: List[QuestionPerformance],
        gaps: List[ConceptGap],
        metrics: PerformanceMetrics,
    ) -> tuple[List[str], List[str]]:
        strengths: List[str] = []
        weaknesses: List[str] = []

        # Strengths from high performing questions
        for p in perfs:
            if p.correctness >= 0.80 and p.depth >= 0.60 and p.covered_concepts:
                strengths.append(
                    f"Strong conceptual mastery on {p.question_id} ({p.topic}): accurately articulated {', '.join(p.covered_concepts[:3])}."
                )

        if metrics.communication and metrics.communication >= 75.0:
            strengths.append(
                f"Consistently articulate technical communication (score {metrics.communication:.1f}/100) with clear structure and relevance."
            )

        if not strengths:
            strengths.append("Demonstrated fundamental familiarity with evaluated core concepts.")

        # Weaknesses from critical gaps
        for g in gaps:
            if g.severity == "high":
                weaknesses.append(
                    f"Recurrent concept gap in '{g.concept}': unaddressed across {len(g.affected_questions)} questions ({', '.join(g.affected_questions)})."
                )

        # Weaknesses from knowledge gap signals
        dont_know_perfs = [p for p in perfs if p.is_dont_know]
        if dont_know_perfs:
            weaknesses.append(
                f"Candidate explicitly noted lack of familiarity on {len(dont_know_perfs)} question(s) ({', '.join(p.question_id for p in dont_know_perfs)})."
            )

        if not weaknesses and gaps:
            weaknesses.append(f"Minor omissions in specific sub-concepts ({', '.join(g.concept for g in gaps[:2])}).")
        elif not weaknesses:
            weaknesses.append("No critical concept gaps identified during the session.")

        return strengths, weaknesses

    def _build_contradiction_reports(self, state: InterviewState) -> List[ContradictionReport]:
        reports: List[ContradictionReport] = []
        for c in state.contradiction_flags:
            reports.append(
                ContradictionReport(
                    slot=c.slot,
                    earlier_value=c.earlier_value,
                    later_value=c.later_value,
                    earlier_turn=c.earlier_turn,
                    later_turn=c.later_turn,
                    severity="inconsistency",
                    evidence=(
                        f"Inconsistency observed regarding '{c.slot}': candidate stated '{c.earlier_value}' "
                        f"on turn {c.earlier_turn}, but indicated '{c.later_value}' on turn {c.later_turn}."
                    ),
                )
            )
        return reports

    def _build_round_reports(
        self,
        state: InterviewState,
        perfs: List[QuestionPerformance],
    ) -> List[RoundReport]:
        by_round: Dict[str, List[QuestionPerformance]] = {}
        for p in perfs:
            r = p.round
            if r not in by_round:
                by_round[r] = []
            by_round[r].append(p)

        reports: List[RoundReport] = []
        for r_name, round_perfs in by_round.items():
            r_score = round(sum(p.correctness for p in round_perfs) / len(round_perfs) * 100.0, 1)
            covered = sorted(list({c for p in round_perfs for c in p.covered_concepts}))
            missing = sorted(list({c for p in round_perfs for c in p.missing_concepts}))

            r_strengths = [
                f"Clear explanation on {p.question_id}" for p in round_perfs if p.correctness >= 0.75
            ]
            r_weaknesses = [
                f"Concept gap on {p.question_id}" for p in round_perfs if p.correctness < 0.50
            ]

            reports.append(
                RoundReport(
                    round=r_name,
                    questions_answered=len(round_perfs),
                    round_score=r_score,
                    concepts_covered=covered,
                    concepts_missing=missing,
                    strengths=r_strengths or ["Addressed baseline questions in round."],
                    weaknesses=r_weaknesses or ["No severe deficiencies in round."],
                    completion_reason=f"Completed {len(round_perfs)} allocated question(s) for {r_name} round.",
                    notable_evidence=[f"Turn {p.turn}: {p.question_id} scored {p.correctness * 100:.0f}%" for p in round_perfs],
                )
            )

        return reports

    def _synthesize_hiring_assessment(
        self,
        state: InterviewState,
        metrics: PerformanceMetrics,
        question_performances: List[QuestionPerformance],
        concept_gaps: List[ConceptGap],
        contradictions: List[ContradictionReport],
        strengths: List[str],
        weaknesses: List[str],
    ) -> HiringAssessment:
        num_questions = len(question_performances)
        high_severity_gaps = [g for g in concept_gaps if g.severity == "high"]
        dont_know_count = sum(1 for p in question_performances if p.is_dont_know)

        # 1. Check for Insufficient Evidence
        if num_questions < 3:
            return HiringAssessment(
                recommendation=HiringRecommendation.INSUFFICIENT_EVIDENCE,
                confidence=0.40,
                summary=f"Insufficient evidence: candidate answered only {num_questions} question(s). A minimum of 3 answered questions is required for a conclusive hiring assessment.",
                supporting_dimensions={"overall_score": metrics.overall_score},
                key_strengths=strengths,
                key_risks=["Limited question sample size prevents reliable competency evaluation."],
                evidence_citations=[p.question_id for p in question_performances],
                caveats=["Recommendation withheld due to insufficient turn volume."],
            )

        if dont_know_count == num_questions and num_questions > 0:
            return HiringAssessment(
                recommendation=HiringRecommendation.INSUFFICIENT_EVIDENCE,
                confidence=0.45,
                summary="Insufficient evidence: candidate expressed knowledge gaps across all asked questions; insufficient demonstration of evaluated skills.",
                supporting_dimensions={"overall_score": metrics.overall_score},
                key_strengths=[],
                key_risks=["Candidate was unable to address questions across all probed competency areas."],
                evidence_citations=[p.question_id for p in question_performances],
                caveats=["Technical depth could not be verified due to unanswered questions."],
            )

        # 2. Transparent Evidence-Based Routing
        # Strong Yes: >= 80.0 overall, no high severity gaps, <= 1 minor contradiction
        if metrics.overall_score >= 80.0 and len(high_severity_gaps) == 0 and len(contradictions) <= 1:
            rec = HiringRecommendation.STRONG_YES
            conf = 0.90
            summary = (
                f"Strong Yes recommendation: candidate demonstrated superior technical accuracy ({metrics.technical_performance:.1f}%), "
                f"consistent architectural depth ({metrics.conceptual_depth:.1f}%), and zero recurring concept gaps."
            )
            risks = ["Candidate mastery is high; ensure seniority level and compensation match expectations."]

        # Yes: >= 65.0 overall and technical >= 60.0
        elif metrics.overall_score >= 65.0 and (metrics.technical_performance or 0.0) >= 60.0:
            rec = HiringRecommendation.YES
            conf = 0.80
            summary = (
                f"Yes recommendation: candidate demonstrated solid technical and problem-solving competence ({metrics.overall_score:.1f}%), "
                "meeting requirements for the evaluated role profile."
            )
            risks = [f"Addressable concept gaps in {', '.join(g.concept for g in concept_gaps[:2])}."]

        # Mixed: >= 45.0 overall
        elif metrics.overall_score >= 45.0:
            rec = HiringRecommendation.MIXED
            conf = 0.70
            summary = (
                f"Mixed recommendation: candidate showed foundational capability (score {metrics.overall_score:.1f}%) "
                f"but exhibited noticeable concept gaps ({len(concept_gaps)} gaps identified)."
            )
            risks = [f"Incomplete understanding of {g.concept}" for g in high_severity_gaps[:3]] or ["Moderate conceptual depth; will require senior mentorship."]

        # No: < 45.0 overall
        else:
            rec = HiringRecommendation.NO
            conf = 0.85
            summary = (
                f"No recommendation: candidate performance ({metrics.overall_score:.1f}%) fell below "
                "the required competency threshold for this role."
            )
            risks = ["Substantial gaps across core architectural and applied concepts."]

        citations = [p.question_id for p in question_performances]

        return HiringAssessment(
            recommendation=rec,
            confidence=conf,
            summary=summary,
            supporting_dimensions={
                "overall": metrics.overall_score,
                "technical": metrics.technical_performance or 0.0,
                "depth": metrics.conceptual_depth or 0.0,
                "communication": metrics.communication or 0.0,
            },
            key_strengths=strengths,
            key_risks=risks,
            evidence_citations=citations,
            caveats=["Assessment reflects evaluated responses during simulated interview turns."],
        )

    def _generate_executive_summary(
        self,
        state: InterviewState,
        metrics: PerformanceMetrics,
        assessment: HiringAssessment,
        strengths: List[str],
        gaps: List[ConceptGap],
    ) -> str:
        role_str = f"for the {state.current_topic} role" if state.current_topic else "across target technical domains"
        top_strength = strengths[0] if strengths else "demonstrated foundational familiarity"
        top_gap = f"omissions in {gaps[0].concept}" if gaps else "no critical concept gaps"

        rec_str = getattr(assessment.recommendation, "value", str(assessment.recommendation)).upper()
        return (
            f"Candidate completed an evaluation {role_str} achieving an overall normalized score of "
            f"{metrics.overall_score:.1f}/100. Key strengths include {top_strength.lower()}. "
            f"Identified development areas include {top_gap}. "
            f"The Hiring Committee recommendation is '{rec_str}' "
            f"(confidence {assessment.confidence * 100:.0f}%): {assessment.summary}"
        )
