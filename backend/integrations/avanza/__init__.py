"""
Avanza integration package.

Reverse-engineered against the unofficial `_api` surface (see
docs/avanza_api_reference.md for the full catalogue). All public coroutines
return plain dicts shaped to the same JSON the Avanza web client itself
receives, except where `normalize.py` projects them into the internal
schema used by the Terminal screens.
"""

from .auth import AvanzaAuth, AvanzaSession  # noqa: F401
from .client import AvanzaClient  # noqa: F401
from .storage import AvanzaStorage  # noqa: F401
