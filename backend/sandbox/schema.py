"""Sandbox request/response dataclasses."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Optional


@dataclass
class ExecuteRequest:
    code: str
    files_in: dict[str, str | bytes] = field(default_factory=dict)
    """Map of `filename -> content`. Written into the tmpdir before launch."""
    timeout_s: float = 8.0
    cpu_seconds: int = 10
    mem_mb: int = 512
    file_size_mb: int = 32
    """Output file size cap (per file). PNGs above this are dropped."""
    extra_argv: list[str] = field(default_factory=list)
    """Appended to `python -I main.py …` so callers can pass CLI flags."""


@dataclass
class FileOut:
    name: str
    size_bytes: int
    is_plot: bool
    content_b64: Optional[str] = None
    """Base64-encoded — populated for plots and small files; large files
    return `None` and the caller can fetch them by name from the run dir
    if it persisted (see `persist_dir`)."""


@dataclass
class ExecuteResult:
    success: bool
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
    files_out: list[FileOut] = field(default_factory=list)
    plots: list[FileOut] = field(default_factory=list)
    """Convenience filter — same FileOut entries flagged `is_plot=True`."""
    timed_out: bool = False
    error: Optional[str] = None
    """Set on infrastructure failures (sandbox couldn't start, etc.).
    Code-level errors land in `stderr` with `success=False`."""

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        return d
