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
    scope_hint: str | None = None
    relationship: str | None = None


@dataclass(frozen=True)
class ContextFact:
    dimension: str
    value: str
    scope: str
    quote: str


@dataclass(frozen=True)
class Observation:
    fact: str
    scope: str
    source: Source
    active: bool
    score: float
    terms: tuple[str, ...]
    semantic: bool = False


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
    contextQuotes: list[str] = field(default_factory=list)


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
    pendingContext: dict | None = None
    activeScope: str | None = None
    observations: list[dict] = field(default_factory=list)
    contextFacts: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)
