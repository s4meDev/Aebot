"""Contratos pequenos, sem dependência da interface ou do modelo."""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Literal

Decision = Literal["Conforme", "Não Conforme", "Reprovado"]


@dataclass(frozen=True)
class Source:
    quote: str
    model_text: str
    inherited_from: str | None = None


@dataclass
class Match:
    id: str
    title: str
    severity: Decision | None
    priority: int
    sourceQuote: str
    score: float
    reasons: list[str]
    factGroup: str | None = None
    guidance: str = ""
    message: str = ""
    missingInformation: list[str] = field(default_factory=list)
    supportingRuleIds: list[str] = field(default_factory=list)
    matchedTerms: list[str] = field(default_factory=list)


@dataclass
class Evaluation:
    serviceId: str
    ruleStoreVersion: str
    normalizedQuery: str
    intent: str
    decision: Decision | None = None
    scenarioDecision: Decision | None = None
    outcome: str = "insufficient"
    hasSufficientEvidence: bool = False
    matchedRules: list[Match] = field(default_factory=list)
    primaryRule: str | None = None
    conflicts: list[dict] = field(default_factory=list)
    confidence: str = "insuficiente"
    reasoningSummary: str = ""
    requiresHumanValidation: bool = True
    pendingInformation: list[str] = field(default_factory=list)
    contextApplied: bool = False
    semanticApplied: bool = False
    inferenceCalls: int = 0
    durationMs: float = 0
    errorCode: str | None = None
    content: str = ""

    def to_dict(self) -> dict:
        return asdict(self)
