"""
Candidate Context Memory module.
Maintains structured knowledge about the candidate (skills, projects, claimed technologies)
separate from the turn-by-turn interview session state (Requirements #7, #8, #13).
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field, ConfigDict
from rag.models import ClaimVerificationStatus
from schemas.interview_state import InterviewState, Contradiction


class CandidateClaim(BaseModel):
    """
    A specific claim asserted by or for the candidate.
    Requirement #13: Candidate claims are tracked with verification status.
    """
    model_config = ConfigDict(use_enum_values=True)

    slot: str  # e.g. "primary_database", "caching_layer", "cloud_provider"
    value: str
    status: ClaimVerificationStatus = ClaimVerificationStatus.CANDIDATE_CLAIM
    source: str  # "resume", "project_doc", "spoken_answer"
    turn: int = 0
    confidence: float = 1.0


class CandidateProject(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    name: str
    role: str = ""
    technologies: List[str] = Field(default_factory=list)
    description: str = ""
    claims: List[CandidateClaim] = Field(default_factory=list)


class CandidateContextMemory:
    """
    Long-term and profile memory regarding the candidate.
    Distinct from SessionMemory (InterviewState) which tracks turn-by-turn progression.
    """

    def __init__(self, candidate_id: str):
        self.candidate_id = candidate_id
        self.skills: Set[str] = set()
        self.projects: Dict[str, CandidateProject] = {}
        self.claims: Dict[str, List[CandidateClaim]] = {}  # slot -> list of claims over time

    def add_skill(self, skill: str) -> None:
        if skill and skill.strip():
            self.skills.add(skill.strip().lower())

    def add_project(
        self,
        name: str,
        role: str = "",
        technologies: Optional[List[str]] = None,
        description: str = "",
    ) -> CandidateProject:
        clean_name = name.strip()
        proj = CandidateProject(
            name=clean_name,
            role=role,
            technologies=technologies or [],
            description=description,
        )
        self.projects[clean_name.lower()] = proj
        for tech in (technologies or []):
            self.add_skill(tech)
        return proj

    def record_claim(
        self,
        slot: str,
        value: str,
        status: ClaimVerificationStatus = ClaimVerificationStatus.CANDIDATE_CLAIM,
        source: str = "resume",
        turn: int = 0,
    ) -> CandidateClaim:
        """
        Records an asserted claim into candidate profile memory.
        """
        slot_clean = slot.strip().lower()
        val_clean = value.strip()

        claim = CandidateClaim(
            slot=slot_clean,
            value=val_clean,
            status=status,
            source=source,
            turn=turn,
        )
        if slot_clean not in self.claims:
            self.claims[slot_clean] = []
        self.claims[slot_clean].append(claim)
        return claim

    def get_latest_claim(self, slot: str) -> Optional[CandidateClaim]:
        slot_clean = slot.strip().lower()
        claims = self.claims.get(slot_clean, [])
        return claims[-1] if claims else None

    def get_all_claims(self) -> Dict[str, CandidateClaim]:
        """Returns the latest claim for each slot."""
        return {slot: claim_list[-1] for slot, claim_list in self.claims.items() if claim_list}


    def sync_to_interview_state(self, state: InterviewState) -> List[Contradiction]:
        """
        Synchronizes candidate claims to the interview session's fact_slots,
        detecting any contradictions with previously registered interview assertions.
        Integrates with the existing contradiction detection engine.
        """
        contradictions_found: List[Contradiction] = []

        for slot, claim_list in self.claims.items():
            latest = claim_list[-1]
            # Check if this slot exists in state.fact_slots with differing value
            if slot in state.fact_slots:
                earlier = state.fact_slots[slot]
                if earlier.lower() != latest.value.lower():
                    contra = Contradiction(
                        slot=slot,
                        earlier_value=earlier,
                        later_value=latest.value,
                        earlier_turn=1,
                        later_turn=state.current_turn,
                    )
                    state.contradiction_flags.append(contra)
                    contradictions_found.append(contra)
            else:
                state.fact_slots[slot] = latest.value

        return contradictions_found
