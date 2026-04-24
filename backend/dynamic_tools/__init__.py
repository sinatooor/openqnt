"""
Phase G dynamic-tools registry.

Agents call `create_dynamic_tool(name, code, description)` to author a
new Python tool at runtime. The module is validated (must export a
single function with the same name as the tool, with type-annotated
arguments + return type), saved under `agents/tools/dynamic/<name>.py`,
and indexed in `agents/tools/dynamic/_index.json`.

`call_dynamic_tool(name, kwargs)` loads the module fresh on every call
(so authoring + use can interleave inside a single agent run) and
invokes the function inside the same Phase-G sandbox used by
`execute_python` — agents don't get to import their tool into the
backend's process; they get the result of running it under the same
CPU/RSS/file-size limits everything else sees.
"""
from .registry import (
    DYNAMIC_TOOLS_DIR,
    DynamicToolMeta,
    call_dynamic_tool,
    create_dynamic_tool,
    delete_dynamic_tool,
    list_dynamic_tools,
    read_dynamic_tool_source,
)

__all__ = [
    "DYNAMIC_TOOLS_DIR",
    "DynamicToolMeta",
    "call_dynamic_tool",
    "create_dynamic_tool",
    "delete_dynamic_tool",
    "list_dynamic_tools",
    "read_dynamic_tool_source",
]
