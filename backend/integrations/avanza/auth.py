"""
TOTP-based login flow against Avanza's `_api/authentication/sessions/*`
endpoints. Implements Mode C from §2 of the reference.

Sessions cache the X-SecurityToken + the session/auth cookies so we don't
re-login on every request. Re-auth happens automatically on 401.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, Optional

import httpx

try:
    import pyotp
except ImportError:  # pragma: no cover
    pyotp = None  # type: ignore

logger = logging.getLogger(__name__)

AVANZA_BASE = "https://www.avanza.se"
USER_AGENT = "Mozilla/5.0 (compatible; OpenQwnt/1.0)"


@dataclass
class AvanzaSession:
    """In-memory session state for one Avanza account."""

    security_token: str
    push_subscription_id: Optional[str]
    customer_id: Optional[str]
    cookies: Dict[str, str] = field(default_factory=dict)
    issued_at: float = field(default_factory=time.time)

    def is_fresh(self, ttl_seconds: int = 60 * 60) -> bool:
        return (time.time() - self.issued_at) < ttl_seconds

    def header_dict(self) -> Dict[str, str]:
        return {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "X-SecurityToken": self.security_token,
        }


class AvanzaAuthError(RuntimeError):
    pass


class AvanzaAuth:
    """
    Stateful authenticator. Holds a single in-flight session per credential
    set; concurrent callers wait on the same login future.
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
            timeout=httpx.Timeout(15.0, connect=8.0),
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
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
        r = await self._client.post(
            "/_api/authentication/sessions/usercredentials",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        if r.status_code != 200:
            raise AvanzaAuthError(
                f"username/password rejected ({r.status_code}): {_safe_text(r)}"
            )
        body = r.json() if r.content else {}
        two_factor = body.get("twoFactorLogin") or {}
        method = two_factor.get("method")
        transaction_id = two_factor.get("transactionId")
        if method != "TOTP":
            raise AvanzaAuthError(
                f"Avanza returned unsupported 2FA method '{method}'. Re-enable TOTP in your Avanza settings."
            )

        cookies: Dict[str, str] = {
            k: v for k, v in r.cookies.items()
        }
        totp_code = self._totp.now()
        headers = {
            "Content-Type": "application/json",
        }
        if transaction_id:
            headers["X-AZA-TransactionId"] = transaction_id

        r2 = await self._client.post(
            "/_api/authentication/sessions/totp",
            json={"method": "TOTP", "totpCode": totp_code},
            headers=headers,
            cookies=cookies,
        )
        if r2.status_code != 200:
            raise AvanzaAuthError(
                f"TOTP rejected ({r2.status_code}): {_safe_text(r2)}"
            )
        token = r2.headers.get("X-SecurityToken") or r2.json().get("authenticationSession")
        if not token:
            raise AvanzaAuthError("Avanza response missing X-SecurityToken")

        merged_cookies = {**cookies, **{k: v for k, v in r2.cookies.items()}}
        body2 = r2.json() if r2.content else {}
        return AvanzaSession(
            security_token=token,
            push_subscription_id=body2.get("pushSubscriptionId"),
            customer_id=body2.get("customerId"),
            cookies=merged_cookies,
            issued_at=time.time(),
        )

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, str]] = None,
        json_body: Optional[Dict[str, object]] = None,
        retry_on_401: bool = True,
    ) -> httpx.Response:
        session = await self.session()
        headers = session.header_dict()
        if json_body is not None:
            headers["Content-Type"] = "application/json"
        r = await self._client.request(
            method,
            path,
            params=params,
            json=json_body,
            headers=headers,
            cookies=session.cookies,
        )
        if r.status_code == 401 and retry_on_401:
            session = await self.session(force=True)
            headers = session.header_dict()
            if json_body is not None:
                headers["Content-Type"] = "application/json"
            r = await self._client.request(
                method,
                path,
                params=params,
                json=json_body,
                headers=headers,
                cookies=session.cookies,
            )
        return r


def _safe_text(r: httpx.Response, limit: int = 200) -> str:
    try:
        return r.text[:limit]
    except Exception:
        return "<no body>"
