"""
Interactive Brokers integration package.

Wraps the existing `backend/execution/ibkr_broker.py::IBKRBroker` (which
already speaks the official `ibapi` protocol against TWS / IB Gateway)
behind the same router pattern the Avanza integration uses, so the UI
can connect / status / sync / fetch positions over a stable HTTP shape.

The IBKR-specific value-add over `/api/execution/*` is that we surface
account snapshots, positions, and per-instrument quotes through routes
matching `/api/integrations/avanza/*`, which lets the frontend treat the
two brokers uniformly on the Portfolio page and in the AI chat tools.
"""

from .manager import IBKRManager, get_ibkr_manager  # noqa: F401
from .storage import IBKRStorage, get_ibkr_storage  # noqa: F401
