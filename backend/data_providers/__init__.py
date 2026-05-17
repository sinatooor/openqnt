"""
Data-provider manifest + generic executor for the `apiDataSource` strategy
node. The manifest enumerates external HTTP APIs we have keys for; the
executor resolves a (provider, endpoint, params) tuple into an HTTP call
and returns parsed JSON. The AI strategy-builder reads the manifest via
`list_integrations` / `lookup_integration` tools to know what is available.
"""

from .executor import (
    fetch_api_data,
    list_providers,
    lookup_endpoint,
    load_manifest,
    ManifestError,
    EndpointError,
)

__all__ = [
    "fetch_api_data",
    "list_providers",
    "lookup_endpoint",
    "load_manifest",
    "ManifestError",
    "EndpointError",
]
