"""
backend/memory — the copilot's long-term "brain".

A single shared, file-backed knowledge base the primary copilot reads before
it works (retrieval) and updates after it works (the learning phase / curator):

    memory/
      soul.md        the copilot's personality        (human-only)
      user.md        who the user is                   (agent may refine + user edits)
      portfolio.md   the whole-portfolio picture       (agent + user)
      watchlist.md   non-held tickers of interest      (agent + user)
      market.md      macro / regime notes              (agent + user)
      lessons.md     durable trading lessons/playbook  (agent + user)
      journal.md     append-only, rolling activity log
      assets/<TICKER>.md   per-asset notes             (agent + user)

Public surface:
  - store:     read/write/seed/list of the files (path-guarded, lock-serialized)
  - retrieval: build the scoped context injected into a run
  - curator:   reflect_and_learn() — the post-run learning phase
"""

from . import store, retrieval, curator, tools  # noqa: F401

__all__ = ["store", "retrieval", "curator", "tools"]
