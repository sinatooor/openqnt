"""
Generic executor for the `apiDataSource` node.

Resolves a (provider, endpoint, param_overrides) tuple from
`manifest.json` into an HTTP request, performs it with the right auth
style, and returns parsed JSON. No per-provider Python — adding a new API
means editing the manifest, not this file.
"""

from __future__ import annotations

import json
import os
import re
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests


MANIFEST_PATH = Path(__file__).parent / "manifest.json"


class ManifestError(Exception):
    """Raised when the manifest file is missing or malformed."""


class EndpointError(Exception):
    """Raised when a provider/endpoint lookup or request fails."""


# ---------------------------------------------------------------------------
# Manifest loading (cached; reloads if mtime changes)
# ---------------------------------------------------------------------------

_cache_lock = threading.Lock()
_cached_manifest: Optional[Dict[str, Any]] = None
_cached_mtime: Optional[float] = None


def load_manifest() -> Dict[str, Any]:
    """Return the parsed manifest, reloading from disk if it changed."""
    global _cached_manifest, _cached_mtime
    try:
        mtime = MANIFEST_PATH.stat().st_mtime
    except FileNotFoundError as e:
        raise ManifestError(f"manifest not found at {MANIFEST_PATH}") from e

    with _cache_lock:
        if _cached_manifest is None or _cached_mtime != mtime:
            try:
                _cached_manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                raise ManifestError(f"manifest.json is invalid JSON: {e}") from e
            _cached_mtime = mtime
        return _cached_manifest


# ---------------------------------------------------------------------------
# Discovery helpers (used by the router and the AI builder tools)
# ---------------------------------------------------------------------------

def list_providers() -> List[Dict[str, Any]]:
    """Compact summary of every provider — for `list_integrations` tool."""
    manifest = load_manifest()
    out: List[Dict[str, Any]] = []
    for pid, p in (manifest.get("providers") or {}).items():
        env_key = p.get("envKey")
        out.append({
            "id": pid,
            "name": p.get("name", pid),
            "envKey": env_key,
            "hasKey": bool(env_key and os.getenv(env_key)),
            "baseUrl": p.get("baseUrl"),
            "docsUrl": p.get("docsUrl"),
            "endpoints": sorted((p.get("endpoints") or {}).keys()),
        })
    return out


def lookup_endpoint(provider: str, endpoint: str) -> Dict[str, Any]:
    """Full spec for one endpoint — for `lookup_integration` tool."""
    manifest = load_manifest()
    providers = manifest.get("providers") or {}
    p = providers.get(provider)
    if not p:
        raise EndpointError(
            f"unknown provider: {provider!r}. "
            f"Known: {sorted(providers.keys())}"
        )
    endpoints = p.get("endpoints") or {}
    spec = endpoints.get(endpoint)
    if not spec:
        raise EndpointError(
            f"unknown endpoint {endpoint!r} for provider {provider!r}. "
            f"Known: {sorted(endpoints.keys())}"
        )
    env_key = p.get("envKey")
    return {
        "provider": provider,
        "endpoint": endpoint,
        "name": p.get("name", provider),
        "baseUrl": p.get("baseUrl"),
        "docsUrl": p.get("docsUrl"),
        "envKey": env_key,
        "hasKey": bool(env_key and os.getenv(env_key)),
        "authStyle": p.get("authStyle"),
        "authParam": p.get("authParam"),
        "method": spec.get("method", "GET"),
        "path": spec.get("path"),
        "params": spec.get("params") or {},
        "output": spec.get("output") or {},
        "description": spec.get("description"),
    }


# ---------------------------------------------------------------------------
# The actual fetch
# ---------------------------------------------------------------------------

_TEMPLATE_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def _apply_template(path: str, values: Dict[str, Any]) -> Tuple[str, set]:
    """Replace {name} placeholders in `path` with values; return (path, used_keys)."""
    used: set = set()

    def _sub(m: re.Match) -> str:
        key = m.group(1)
        if key not in values:
            raise EndpointError(f"missing templated path param: {key}")
        used.add(key)
        return str(values[key])

    return _TEMPLATE_RE.sub(_sub, path), used


def _merge_params(
    spec_params: Dict[str, Any],
    overrides: Dict[str, Any],
) -> Dict[str, Any]:
    """Combine spec defaults + overrides, enforcing `required`."""
    merged: Dict[str, Any] = {}
    for name, meta in spec_params.items():
        if name in overrides and overrides[name] is not None:
            merged[name] = overrides[name]
        elif "default" in meta:
            merged[name] = meta["default"]
        elif meta.get("required"):
            raise EndpointError(f"missing required param: {name}")
    # Accept overrides not present in the spec — manifest may be incomplete.
    for name, value in overrides.items():
        if name not in merged and value is not None:
            merged[name] = value
    return merged


def fetch_api_data(
    provider: str,
    endpoint: str,
    param_overrides: Optional[Dict[str, Any]] = None,
    timeout: float = 15.0,
) -> Any:
    """
    Execute a manifest endpoint and return the parsed JSON response.

    Raises:
        EndpointError: missing provider/endpoint, missing required param,
            missing env key, network error, or non-2xx response.
    """
    spec = lookup_endpoint(provider, endpoint)
    overrides = dict(param_overrides or {})

    method = (spec["method"] or "GET").upper()
    base_url = spec["baseUrl"] or ""
    path = spec["path"] or ""

    all_values = _merge_params(spec["params"], overrides)

    # Pull out any params consumed by path templating.
    templated_path, used = _apply_template(path, all_values)
    query_or_body = {k: v for k, v in all_values.items() if k not in used}

    url = base_url.rstrip("/") + "/" + templated_path.lstrip("/")

    auth_style = (spec.get("authStyle") or "").lower()
    auth_param = spec.get("authParam")
    env_key = spec.get("envKey")
    api_key = os.getenv(env_key) if env_key else None

    if env_key and not api_key:
        raise EndpointError(
            f"missing env var {env_key} required by provider {provider!r}"
        )

    headers: Dict[str, str] = {"Accept": "application/json"}
    request_kwargs: Dict[str, Any] = {"timeout": timeout, "headers": headers}

    # Split params into URL query vs request body. For GETs everything is
    # query; for non-GETs the user-supplied params become the JSON body.
    # `query`-style auth always goes in URL params (Apify and other services
    # accept ?token=... on POSTs), regardless of method.
    url_params: Dict[str, Any] = {}
    body_params: Dict[str, Any] = {}
    if method == "GET":
        url_params.update(query_or_body)
    else:
        body_params.update(query_or_body)

    if auth_style == "query" and api_key and auth_param:
        url_params[auth_param] = api_key
    elif auth_style == "header" and api_key and auth_param:
        headers[auth_param] = api_key
    elif auth_style == "bearer" and api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    elif auth_style == "body" and api_key and auth_param:
        body_params[auth_param] = api_key

    if method == "GET":
        request_kwargs["params"] = url_params
    else:
        if url_params:
            request_kwargs["params"] = url_params
        request_kwargs["json"] = body_params
        headers["Content-Type"] = "application/json"

    try:
        response = requests.request(method, url, **request_kwargs)
    except requests.RequestException as e:
        raise EndpointError(f"{provider}.{endpoint}: network error: {e}") from e

    if response.status_code >= 400:
        body_preview = response.text[:300]
        raise EndpointError(
            f"{provider}.{endpoint}: HTTP {response.status_code}: {body_preview}"
        )

    try:
        return response.json()
    except ValueError:
        return {"raw": response.text}
