"""
Orchestrator exceptions.
"""


class OrchestratorError(Exception):
    """Base exception for orchestrator errors."""
    pass


class InvalidStateTransitionError(OrchestratorError):
    """Raised when an illegal lifecycle phase transition is attempted."""
    def __init__(self, current_phase: str, target_phase: str, reason: str | None = None):
        msg = f"Invalid state transition from {current_phase} to {target_phase}"
        if reason:
            msg += f": {reason}"
        super().__init__(msg)
        self.current_phase = current_phase
        self.target_phase = target_phase


class InterviewCompletedError(OrchestratorError):
    """Raised when an operation is attempted on an already-completed interview."""
    pass
