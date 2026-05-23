"""
TOTP-based login flow against Avanza's `_api/authentication/sessions/*`
endpoints.

Key findings from browser traffic capture (2026-05-23):
- Data requests are authenticated purely via cookies (csid, cstoken, AZACSRF).
- X-SecurityToken is NOT sent by the browser for any data endpoint.
- The server requires HTTP/2 (h2 package) — HTTP/1.1 gets a silent RST.
- httpx's internal cookie jar must be used directly; manually passing the
  cookie dict to each request caused the server to drop connections.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

import httpx

try:
    import pyotp
except ImportError:
    pyotp = None  # type: ignore

logger = logging.getLogger(__name__)

AVANZA_BASE = "https://www.avanza.se"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/148.0.0.0 Safari/537.36"
)
_BROWSER_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
}


@dataclass
class AvanzaSession:
    """Minimal session state — cookies live in the httpx client's jar."""
    issued_at: float = field(default_factory=time.time)

    def is_fresh(self, ttl_seconds: int = 60 * 55) -> bool:
        return (time.time() - self.issued_at) < ttl_seconds


class AvanzaAuthError(RuntimeError):
    pass


class AvanzaAuth:
    """
    Stateful authenticator using HTTP/2 and cookie-based session management.
    The httpx AsyncClient cookie jar is the source of truth for session state;
    no manual cookie extraction or X-SecurityToken injection is needed.
    """

    def __init__(
        self,
        username: str,
        password: str,
        totp_secret: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        if not (username and password and totp_secret):
            raise AvanzaAuthError("username, password, and totp_secret are required")
        if pyotp is None:
            raise AvanzaAuthError("pyotp is not installed; pip install pyotp")
        self._username = username
        self._password = password
        self._totp = pyotp.TOTP(totp_secret)
        self._lock = asyncio.Lock()
        self._session: Optional[AvanzaSession] = None
        self._owned_client = client is None
        self._client = client or httpx.AsyncClient(
            base_url=AVANZA_BASE,
            http2=True,
            timeout=httpx.Timeout(20.0, connect=8.0),
            headers=_BROWSER_HEADERS,
            follow_redirects=True,
        )

    async def aclose(self) -> None:
        if self._owned_client:
            await self._client.aclose()

    async def session(self, force: bool = False) -> AvanzaSession:
        async with self._lock:
            if self._session and not force and self._session.is_fresh():
                return self._session
            self._session = await self._login()
            return self._session

    async def _login(self) -> AvanzaSession:
        payload = {
            "maxInactiveMinutes": 1440,
            "username": self._username,
            "password": self._password,
        }
        r1 = await self._client.post(
            "/_api/authentication/sessions/usercredentials",
            json=payload,
        )
        if r1.status_code != 200:
            raise AvanzaAuthError(
                f"username/password rejected ({r1.status_code}): {_safe_text(r1)}"
            )
        body1 = r1.json() if r1.content else {}
        two_factor = body1.get("twoFactorLogin") or {}
        method = two_factor.get("method")
        transaction_id = two_factor.get("transactionId")
        if method != "TOTP":
            raise AvanzaAuthError(
                f"Avanza returned unsupported 2FA method '{method}'. "
                "Re-enable TOTP in your Avanza settings."
            )

        totp_code = self._totp.now()
        headers: dict = {}
        if transaction_id:
            headers["X-AZA-TransactionId"] = transaction_id

        r2 = await self._client.post(
            "/_api/authentication/sessions/totp",
            json={"method": "TOTP", "totpCode": totp_code},
            headers=headers,
        )
        if r2.status_code != 200:
            raise AvanzaAuthError(
                f"TOTP rejected ({r2.status_code}): {_safe_text(r2)}"
            )

        # Verify session cookies are now in the client's jar
        if not self._client.cookies.get("csid"):
            raise AvanzaAuthError(
                "Login appeared to succeed but no session cookie received. "
                "TOTP code may have been reused — wait 30 s and try again."
            )

        return AvanzaSession(issued_at=time.time())

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[dict] = None,
        json_body: Optional[dict] = None,
        retry_on_401: bool = True,
    ) -> httpx.Response:
        await self.session()

        extra: dict = {}
        if json_body is not None:
            extra["json"] = json_body

        # CSRF: POST/PUT/PATCH/DELETE require X-SecurityToken set to the
        # AZACSRF cookie value (verified via browser capture).
        headers: dict = {}
        if method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
            csrf = self._client.cookies.get("AZACSRF")
            if csrf:
                headers["X-SecurityToken"] = csrf

        async def _do() -> httpx.Response:
            return await self._client.request(
                method, path, params=params, headers=headers or None, **extra,
            )

        try:
            r = await _do()
        except httpx.RemoteProtocolError:
            r = await _do()

        if r.status_code == 401 and retry_on_401:
            self._session = None
            await self.session(force=True)
            # Refresh CSRF header from the new session
            if method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
                csrf = self._client.cookies.get("AZACSRF")
                if csrf:
                    headers["X-SecurityToken"] = csrf
            try:
                r = await _do()
            except httpx.RemoteProtocolError:
                r = await _do()

        return r


def _safe_text(r: httpx.Response, limit: int = 200) -> str:
    try:
        return r.text[:limit]
    except Exception:
        return "<no body>"
