"""
Read-only HTTP surface for the data-provider manifest.

GET  /api/data-providers
    → list of providers with hasKey + endpoint names.
GET  /api/data-providers/{provider}/{endpoint}
    → full endpoint spec.
POST /api/data-providers/{provider}/{endpoint}/call
    → execute the endpoint with body { paramOverrides: {...} } and return
      the upstream JSON. Used by the apiDataSource node at run time and
      handy for ad-hoc testing.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from data_providers import (
    EndpointError,
    ManifestError,
    fetch_api_data,
    list_providers,
    lookup_endpoint,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/data-providers", tags=["data-providers"])


class CallRequest(BaseModel):
    paramOverrides: Optional[Dict[str, Any]] = None


@router.get("")
async def list_data_providers() -> Dict[str, Any]:
    try:
        return {"providers": list_providers()}
    except ManifestError as e:
        raise HTTPException(500, str(e))


@router.get("/{provider}/{endpoint}")
async def get_endpoint_spec(provider: str, endpoint: str) -> Dict[str, Any]:
    try:
        return lookup_endpoint(provider, endpoint)
    except EndpointError as e:
        raise HTTPException(404, str(e))
    except ManifestError as e:
        raise HTTPException(500, str(e))


@router.post("/{provider}/{endpoint}/call")
async def call_endpoint(
    provider: str,
    endpoint: str,
    req: CallRequest,
) -> Dict[str, Any]:
    try:
        data = fetch_api_data(provider, endpoint, req.paramOverrides or {})
    except EndpointError as e:
        raise HTTPException(400, str(e))
    except ManifestError as e:
        raise HTTPException(500, str(e))
    return {"provider": provider, "endpoint": endpoint, "data": data}
