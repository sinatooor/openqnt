"""
Phase G sandbox — run untrusted-ish Python in an isolated subprocess.

Public surface intentionally tiny:

    from sandbox import execute_python, ExecuteRequest, ExecuteResult

The runner enforces a CPU/RSS/file-size budget via `resource.setrlimit`,
runs `python -I` in a per-call tmpdir, captures stdout/stderr, and
returns any new files (PNG plots in particular) the script left behind.

Threat model: this is *defence-in-depth*, not a security boundary. We
trust agent-generated code on a single-tenant developer box. Upgrade to
Docker per run for multi-tenant. See PHASE_G_RESULT.md.
"""
from .runner import execute_python
from .schema import ExecuteRequest, ExecuteResult

__all__ = ["execute_python", "ExecuteRequest", "ExecuteResult"]
