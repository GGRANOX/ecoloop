from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody


class BayesRequest(BaseModel):
    prior_plastic: float = Field(0.45, ge=0.0, le=1.0, description="P(plastic)")
    likelihood_plastic: float = Field(0.8, ge=0.0, le=1.0, description="P(E | plastic)")
    likelihood_paper: float = Field(0.2, ge=0.0, le=1.0, description="P(E | paper)")

    @model_validator(mode="after")
    def evidence_possible(self):
        pe = self.likelihood_plastic * self.prior_plastic + self.likelihood_paper * (1 - self.prior_plastic)
        if pe <= 0:
            raise ValueError("P(E) would be 0 — at least one class must make the evidence possible")
        return self


class MDPRequest(BaseModel):
    posterior_plastic: float = Field(0.7, ge=0.0, le=1.0)
    prior_plastic: float = Field(0.45, ge=0.0, le=1.0)
    gamma: float = Field(0.9, ge=0.0, le=0.99)
    inspect_success: float = Field(0.8, ge=0.05, le=1.0)
    verified_accuracy: float = Field(0.95, ge=0.5, le=1.0)


class AStarRequest(BaseModel):
    width: int = Field(12, ge=2, le=40)
    height: int = Field(8, ge=2, le=30)
    start: list[int] = Field(..., min_length=2, max_length=2)
    goal: list[int] = Field(..., min_length=2, max_length=2)
    obstacles: list[list[int]] = Field(default_factory=list, max_length=1200)


class HealthResponse(BaseModel):
    status: str
    mode: str
    model: Optional[dict[str, Any]] = None
