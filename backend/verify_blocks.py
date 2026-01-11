#!/usr/bin/env python3
import json
import os
import re
import sys

# Paths
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLOCK_MAP_FILE = os.path.join(REPO_ROOT, "backend", "block_python_map.json")
INDICATOR_CONFIG_FILE = os.path.join(REPO_ROOT, "src", "lib", "indicatorConfigs.ts")

def load_json(path):
    with open(path, "r") as f:
        return json.load(f)

def parse_ts_configs(path):
    """
    Parses src/lib/indicatorConfigs.ts to extract indicator parameters.
    Returns dict: { indicator_name: { params: [param_names...], components: [comp_names...] } }
    """
    with open(path, "r") as f:
        content = f.read()

    configs = {}
    
    # Regex to find each indicator config block: 'name': { ... }
    # specific pattern matches: 'key': { ... mqlFunction: ... }
    # This is a bit brittle but sufficient for this specific file structure
    
    # We'll split the file by top-level keys in the indicatorConfigs object
    # Find the start of the object
    start_marker = "export const indicatorConfigs: Record<string, IndicatorConfig> = {"
    start_idx = content.find(start_marker)
    if start_idx == -1:
        print("Error: Could not find indicatorConfigs start marker")
        return {}
    
    # Extract the block
    block = content[start_idx + len(start_marker):]
    
    # Simple state machine to parse keys
    # Looking for: 'key': { ... }
    
    # Find all occurences of keys line like: 'macd': {
    iterator = re.finditer(r"'([a-zA-Z0-9_]+)':\s*{", block)
    
    indices = []
    for match in iterator:
        indices.append((match.group(1), match.start()))
        
    for i in range(len(indices)):
        name = indices[i][0]
        start_pos = indices[i][1]
        end_pos = indices[i+1][1] if i + 1 < len(indices) else len(block)
        
        chunk = block[start_pos:end_pos]
        
        # Extract params
        params = []
        # Match params array items: { name: 'paramName' ... }
        param_matches = re.finditer(r"name:\s*'([a-zA-Z0-9_]+)'", chunk)
        for pm in param_matches:
            p_name = pm.group(1)
            # The config object has 'name', 'displayName' etc at top level too, ignore those specific ones if they are not inside 'params': [ ... ] 
            # But regex above matches any 'name: ...'.
            # Let's be more specific. Find params: [ ... ] block first.
            pass
        
        # Better approach for chunk: extract contents of params: [ ... ]
        params_block = re.search(r"params:\s*\[(.*?)\]", chunk, re.DOTALL)
        if params_block:
            p_content = params_block.group(1)
            p_names = re.findall(r"name:\s*'([a-zA-Z0-9_]+)'", p_content)
            params.extend(p_names)
            
        configs[name] = {"params": params}
        
    return configs

def verify_sync():
    print(f"Verifying blocks against {BLOCK_MAP_FILE}...")
    
    if not os.path.exists(BLOCK_MAP_FILE):
        print(f"Error: {BLOCK_MAP_FILE} not found.")
        return False
        
    if not os.path.exists(INDICATOR_CONFIG_FILE):
        print(f"Error: {INDICATOR_CONFIG_FILE} not found.")
        return False

    backend_map_root = load_json(BLOCK_MAP_FILE)
    backend_map = backend_map_root.get("indicators", {})
    # Create case-insensitive lookup
    backend_map_lower = {k.lower(): v for k, v in backend_map.items()}
    
    frontend_configs = parse_ts_configs(INDICATOR_CONFIG_FILE)
    
    errors = []
    
    # Check Indicators (frontend source of truth)
    for name, config in frontend_configs.items():
        name_lower = name.lower()
        
        # In backend map, keys might be different. Let's look for match.
        # Direct match first (case-insensitive)
        backend_entry = backend_map_lower.get(name_lower)
        if not backend_entry:
            # Try with ta_ prefix if not found (common pattern)
            backend_entry = backend_map_lower.get(f"ta_{name_lower}")
            
        if not backend_entry:
            errors.append(f"[FAIL] Missing backend mapping for frontend indicator: '{name}'")
            continue
             # Try checking if any backend entry refers to this block type
             # But backend map keys ARE the block types usually.
             
             # Exception: basic stuff like 'sma' might be directly mapped.
             # Let's just log missing if strictly not found
            # Filter out potentially ignored ones?
            errors.append(f"[FAIL] Missing backend mapping for frontend indicator: '{name}'")
            continue
            
        # Check params
        backend_args = backend_entry.get("args", [])
        
        # Extract param names from backend args string formats like "{fast}"
        backend_params = []
        for arg in backend_args:
            if isinstance(arg, str):
                matches = re.findall(r"\{([a-zA-Z0-9_]+)\}", arg)
                backend_params.extend(matches)
        
        # Compare
        frontend_params = set(config['params'])
        # Filter out common ones that might not be in params list? 
        # No, config list is authoritative.
        
        for bp in backend_params:
            if bp not in frontend_params:
                # Potential mismatch or alias
                # Special cases mappings could be added here
                # e.g. k_period vs kPeriod
                errors.append(f"[FAIL] Parameter mismatch for '{name}': Backend expects '{{{bp}}}', but '{bp}' not found in TS config (Available: {list(frontend_params)}).")

    if errors:
        print("\nValidation Failed with the following errors:")
        for e in errors:
            print("  " + e)
        return False
        
    print("Validation Passed!")
    return True

if __name__ == "__main__":
    success = verify_sync()
    sys.exit(0 if success else 1)