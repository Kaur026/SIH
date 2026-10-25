"""Overlap Engine: cross-bureau overlapping-complaint detection for AICTE (SIH 26264)."""
from .config import EngineConfig
from .detector import OverlapEngine, make_alert_id
from .models import Case, DetectionResult, Institution, OverlapAlert, HEADLINE
from .resolver import AMBIGUOUS, RESOLVED, UNRESOLVED, InstitutionResolver, Resolution

__all__ = ["EngineConfig", "OverlapEngine", "make_alert_id", "Case", "DetectionResult",
           "Institution", "OverlapAlert", "HEADLINE", "InstitutionResolver", "Resolution",
           "RESOLVED", "AMBIGUOUS", "UNRESOLVED", "CategoryTagger", "Tagging", "summarize"]
from .tagging import CategoryTagger, Tagging
from .summarize import summarize
__version__ = "0.1.0"
