"""
Exploration Tools - Tools for codebase analysis and improvement discovery.

These tools power the exploratory agent to understand the codebase,
identify patterns, and discover improvement opportunities.
"""

import os
import re
import ast
import json
from typing import Optional
from collections import defaultdict
from pathlib import Path


# Project root detection
def _find_project_root() -> str:
    """Find the PPM project root directory."""
    current = Path(__file__).resolve()
    # Navigate up to find the project root (contains package.json and backend/)
    for parent in current.parents:
        if (parent / "package.json").exists() and (parent / "backend").exists():
            return str(parent)
    # Fallback
    return str(current.parent.parent.parent.parent)


PROJECT_ROOT = _find_project_root()


def scan_project_structure(
    root_dir: Optional[str] = None,
    max_depth: int = 4,
    include_hidden: bool = False
) -> dict:
    """
    Scan the project structure and return a hierarchical representation.
    
    Args:
        root_dir: Root directory to scan (defaults to project root)
        max_depth: Maximum directory depth to traverse
        include_hidden: Whether to include hidden files/directories
        
    Returns:
        Dictionary with project structure, file counts, and categorization
    """
    root = root_dir or PROJECT_ROOT
    
    structure = {
        "root": root,
        "directories": [],
        "files_by_type": defaultdict(list),
        "summary": {
            "total_files": 0,
            "total_directories": 0,
            "by_extension": defaultdict(int)
        }
    }
    
    # Directories to skip
    skip_dirs = {
        "node_modules", "venv", ".git", "__pycache__", 
        ".pytest_cache", "dist", "build", ".adk", "chroma_db", "chroma_db_v2"
    }
    
    def scan_dir(path: str, depth: int = 0) -> dict:
        if depth > max_depth:
            return {"name": os.path.basename(path), "type": "directory", "truncated": True}
        
        result = {
            "name": os.path.basename(path),
            "type": "directory",
            "children": []
        }
        
        try:
            entries = sorted(os.listdir(path))
            for entry in entries:
                if not include_hidden and entry.startswith("."):
                    continue
                if entry in skip_dirs:
                    continue
                    
                full_path = os.path.join(path, entry)
                rel_path = os.path.relpath(full_path, root)
                
                if os.path.isdir(full_path):
                    structure["summary"]["total_directories"] += 1
                    child = scan_dir(full_path, depth + 1)
                    result["children"].append(child)
                else:
                    structure["summary"]["total_files"] += 1
                    ext = os.path.splitext(entry)[1].lower()
                    structure["summary"]["by_extension"][ext] += 1
                    structure["files_by_type"][ext].append(rel_path)
                    result["children"].append({
                        "name": entry,
                        "type": "file",
                        "extension": ext,
                        "path": rel_path
                    })
        except PermissionError:
            result["error"] = "permission denied"
            
        return result
    
    structure["tree"] = scan_dir(root)
    structure["files_by_type"] = dict(structure["files_by_type"])
    structure["summary"]["by_extension"] = dict(structure["summary"]["by_extension"])
    
    return structure


def analyze_file_content(file_path: str) -> dict:
    """
    Analyze a single file for patterns, complexity, and potential issues.
    
    Args:
        file_path: Absolute or relative path to the file
        
    Returns:
        Dictionary with file analysis including:
        - Line count
        - Complexity metrics (for Python)
        - Function/class definitions
        - Imports
        - Potential issues
    """
    if not os.path.isabs(file_path):
        file_path = os.path.join(PROJECT_ROOT, file_path)
    
    if not os.path.exists(file_path):
        return {"error": f"File not found: {file_path}"}
    
    result = {
        "path": file_path,
        "exists": True,
        "extension": os.path.splitext(file_path)[1].lower(),
        "line_count": 0,
        "size_bytes": os.path.getsize(file_path),
        "analysis": {}
    }
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            lines = content.split('\n')
            result["line_count"] = len(lines)
            
        # Python-specific analysis
        if result["extension"] == ".py":
            result["analysis"] = _analyze_python_file(content, file_path)
            
        # TypeScript/JavaScript analysis
        elif result["extension"] in [".ts", ".tsx", ".js", ".jsx"]:
            result["analysis"] = _analyze_typescript_file(content)
            
    except Exception as e:
        result["error"] = str(e)
        
    return result


def _analyze_python_file(content: str, file_path: str) -> dict:
    """Analyze Python file content."""
    analysis = {
        "functions": [],
        "classes": [],
        "imports": [],
        "todo_comments": [],
        "potential_issues": []
    }
    
    try:
        tree = ast.parse(content)
        
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                analysis["functions"].append({
                    "name": node.name,
                    "line": node.lineno,
                    "args": len(node.args.args),
                    "has_docstring": ast.get_docstring(node) is not None
                })
            elif isinstance(node, ast.ClassDef):
                methods = [n.name for n in node.body if isinstance(n, ast.FunctionDef)]
                analysis["classes"].append({
                    "name": node.name,
                    "line": node.lineno,
                    "methods": methods,
                    "has_docstring": ast.get_docstring(node) is not None
                })
            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        analysis["imports"].append(alias.name)
                else:
                    module = node.module or ""
                    for alias in node.names:
                        analysis["imports"].append(f"{module}.{alias.name}")
                        
        # Find TODO/FIXME comments
        for i, line in enumerate(content.split('\n'), 1):
            if re.search(r'#\s*(TODO|FIXME|XXX|HACK)', line, re.IGNORECASE):
                analysis["todo_comments"].append({
                    "line": i,
                    "text": line.strip()
                })
                
        # Check for potential issues
        if len(analysis["functions"]) > 20:
            analysis["potential_issues"].append("Large file with many functions - consider splitting")
        
        undocumented = [f for f in analysis["functions"] if not f["has_docstring"]]
        if len(undocumented) > 5:
            analysis["potential_issues"].append(f"{len(undocumented)} functions without docstrings")
            
    except SyntaxError as e:
        analysis["syntax_error"] = str(e)
        
    return analysis


def _analyze_typescript_file(content: str) -> dict:
    """Analyze TypeScript/JavaScript file content."""
    analysis = {
        "exports": [],
        "imports": [],
        "components": [],
        "todo_comments": []
    }
    
    # Find imports
    import_pattern = r"import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['\"]([^'\"]+)['\"]"
    analysis["imports"] = re.findall(import_pattern, content)
    
    # Find exports
    export_pattern = r"export\s+(?:default\s+)?(?:function|const|class|interface|type)\s+(\w+)"
    analysis["exports"] = re.findall(export_pattern, content)
    
    # Find React components (rough heuristic)
    component_pattern = r"(?:function|const)\s+(\w+).*?(?:return\s*\(|=>\s*\(?).*?<"
    components = re.findall(component_pattern, content, re.DOTALL)
    analysis["components"] = [c for c in components if c[0].isupper()]
    
    # Find TODO comments
    for i, line in enumerate(content.split('\n'), 1):
        if re.search(r'//\s*(TODO|FIXME|XXX)', line, re.IGNORECASE):
            analysis["todo_comments"].append({
                "line": i,
                "text": line.strip()
            })
            
    return analysis


def find_improvement_opportunities(scope: str = "all") -> list:
    """
    Identify potential improvements across the codebase.
    
    Args:
        scope: Area to focus on - "all", "backend", "frontend", "tests"
        
    Returns:
        List of improvement opportunities with priority and details
    """
    opportunities = []
    
    # Define scope directories
    scope_dirs = {
        "all": [PROJECT_ROOT],
        "backend": [os.path.join(PROJECT_ROOT, "backend")],
        "frontend": [os.path.join(PROJECT_ROOT, "src")],
        "tests": [
            os.path.join(PROJECT_ROOT, "tests"),
            os.path.join(PROJECT_ROOT, "backend", "tests")
        ]
    }
    
    dirs_to_scan = scope_dirs.get(scope, scope_dirs["all"])
    
    for scan_dir in dirs_to_scan:
        if not os.path.exists(scan_dir):
            continue
            
        for root, _, files in os.walk(scan_dir):
            # Skip unwanted directories
            if any(skip in root for skip in ["node_modules", "venv", "__pycache__", ".git"]):
                continue
                
            for file in files:
                if not file.endswith(('.py', '.ts', '.tsx')):
                    continue
                    
                file_path = os.path.join(root, file)
                analysis = analyze_file_content(file_path)
                
                if "error" in analysis:
                    continue
                    
                file_opps = _extract_opportunities(file_path, analysis)
                opportunities.extend(file_opps)
    
    # Sort by priority (higher is more important)
    opportunities.sort(key=lambda x: x.get("priority", 0), reverse=True)
    
    return opportunities[:20]  # Return top 20


def _extract_opportunities(file_path: str, analysis: dict) -> list:
    """Extract improvement opportunities from file analysis."""
    opportunities = []
    rel_path = os.path.relpath(file_path, PROJECT_ROOT)
    
    file_analysis = analysis.get("analysis", {})
    
    # Check for TODO comments (actionable items)
    todos = file_analysis.get("todo_comments", [])
    if todos:
        opportunities.append({
            "type": "todo_items",
            "file": rel_path,
            "priority": 7,
            "description": f"Found {len(todos)} TODO/FIXME comments",
            "details": todos[:5],  # First 5
            "action": "Address TODO comments and implement missing features"
        })
    
    # Check for missing docstrings (Python)
    functions = file_analysis.get("functions", [])
    undocumented = [f for f in functions if not f.get("has_docstring")]
    if len(undocumented) > 3:
        opportunities.append({
            "type": "missing_documentation",
            "file": rel_path,
            "priority": 4,
            "description": f"{len(undocumented)} functions without docstrings",
            "details": [f["name"] for f in undocumented[:5]],
            "action": "Add docstrings to improve code maintainability"
        })
    
    # Check for large files
    if analysis.get("line_count", 0) > 500:
        opportunities.append({
            "type": "large_file",
            "file": rel_path,
            "priority": 5,
            "description": f"Large file with {analysis['line_count']} lines",
            "details": {"classes": len(file_analysis.get("classes", [])), 
                       "functions": len(functions)},
            "action": "Consider splitting into smaller, focused modules"
        })
    
    # Check for syntax errors
    if "syntax_error" in file_analysis:
        opportunities.append({
            "type": "syntax_error",
            "file": rel_path,
            "priority": 10,
            "description": "Syntax error in file",
            "details": file_analysis["syntax_error"],
            "action": "Fix syntax error immediately"
        })
    
    # Check for potential issues flagged during analysis
    for issue in file_analysis.get("potential_issues", []):
        opportunities.append({
            "type": "code_smell",
            "file": rel_path,
            "priority": 5,
            "description": issue,
            "action": "Refactor to improve code quality"
        })
    
    return opportunities


def generate_plan_objective(
    title: str,
    details: str,
    validation_commands: list,
    priority: int = 5
) -> str:
    """
    Generate a markdown objective in plan.md format.
    
    Args:
        title: Short title for the objective
        details: Detailed description of what needs to be done
        validation_commands: List of headless validation commands
        priority: Priority level (1-10, higher = more important)
        
    Returns:
        Markdown formatted objective string
    """
    # Generate a unique ID based on existing objectives
    plan_path = os.path.join(PROJECT_ROOT, "plan.md")
    next_id = 100  # Start auto-generated objectives at 100
    
    if os.path.exists(plan_path):
        with open(plan_path, 'r') as f:
            content = f.read()
            # Find highest objective ID
            ids = re.findall(r'## Objective\s+(\d+)', content)
            if ids:
                next_id = max(int(i) for i in ids) + 1
    
    # Format validation commands
    validation_md = "\n".join([f"* `{cmd}`" for cmd in validation_commands])
    
    objective = f"""## Objective {next_id:03d}

**id:** {next_id:03d}  
**title:** {title}  
**status:** todo  
**priority:** {priority}

**details:**
{details}

**acceptance_criteria:**

* Implementation passes all validation commands
* No regressions in existing tests
* Code follows project patterns and conventions

**validation (headless only):**

{validation_md}

---
"""
    return objective


def get_test_coverage_gaps() -> dict:
    """
    Identify code that may lack test coverage.
    
    Returns:
        Dictionary with coverage analysis and suggestions
    """
    gaps = {
        "backend_files_without_tests": [],
        "frontend_files_without_tests": [],
        "test_file_analysis": [],
        "suggestions": []
    }
    
    # Find all backend Python files
    backend_dir = os.path.join(PROJECT_ROOT, "backend")
    backend_files = set()
    for root, _, files in os.walk(backend_dir):
        if any(skip in root for skip in ["venv", "__pycache__", "tests", ".pytest_cache"]):
            continue
        for f in files:
            if f.endswith('.py') and not f.startswith('test_'):
                backend_files.add(f.replace('.py', ''))
    
    # Find all test files
    test_dirs = [
        os.path.join(PROJECT_ROOT, "tests"),
        os.path.join(PROJECT_ROOT, "backend", "tests"),
        os.path.join(PROJECT_ROOT, "backend")
    ]
    
    tested_modules = set()
    for test_dir in test_dirs:
        if not os.path.exists(test_dir):
            continue
        for f in os.listdir(test_dir):
            if f.startswith('test_') and f.endswith('.py'):
                # Extract module being tested
                module = f.replace('test_', '').replace('.py', '')
                tested_modules.add(module)
    
    # Find gaps
    for module in backend_files:
        if module not in tested_modules and module not in ['__init__', 'main']:
            gaps["backend_files_without_tests"].append(module)
    
    # Generate suggestions
    if gaps["backend_files_without_tests"]:
        gaps["suggestions"].append({
            "type": "add_tests",
            "priority": 6,
            "description": f"{len(gaps['backend_files_without_tests'])} backend modules may lack dedicated tests",
            "modules": gaps["backend_files_without_tests"][:10]
        })
    
    return gaps


def analyze_dependencies(file_path: Optional[str] = None) -> dict:
    """
    Analyze import dependencies for a file or the entire project.
    
    Args:
        file_path: Specific file to analyze, or None for project-wide
        
    Returns:
        Dictionary with dependency graph and analysis
    """
    dependencies = {
        "internal": defaultdict(list),  # Project imports
        "external": defaultdict(list),  # Third-party imports
        "circular": [],  # Potential circular dependencies
        "unused": []  # Potentially unused imports
    }
    
    if file_path:
        files_to_analyze = [file_path]
    else:
        # Analyze all Python files
        files_to_analyze = []
        backend_dir = os.path.join(PROJECT_ROOT, "backend")
        for root, _, files in os.walk(backend_dir):
            if any(skip in root for skip in ["venv", "__pycache__"]):
                continue
            for f in files:
                if f.endswith('.py'):
                    files_to_analyze.append(os.path.join(root, f))
    
    for fpath in files_to_analyze:
        analysis = analyze_file_content(fpath)
        if "error" in analysis:
            continue
            
        imports = analysis.get("analysis", {}).get("imports", [])
        rel_path = os.path.relpath(fpath, PROJECT_ROOT)
        
        for imp in imports:
            if imp.startswith(('backend.', 'adk_agents.', '.')):
                dependencies["internal"][rel_path].append(imp)
            else:
                dependencies["external"][rel_path].append(imp)
    
    dependencies["internal"] = dict(dependencies["internal"])
    dependencies["external"] = dict(dependencies["external"])
    
    return dependencies


# Export all tools
__all__ = [
    "scan_project_structure",
    "analyze_file_content", 
    "find_improvement_opportunities",
    "generate_plan_objective",
    "get_test_coverage_gaps",
    "analyze_dependencies",
    "PROJECT_ROOT"
]
