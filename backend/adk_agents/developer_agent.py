"""
Developer Agent - Autonomous code implementation agent.

This agent implements code changes based on objectives,
following project patterns and ensuring tests pass.
"""

import os
import subprocess
from typing import Optional
from google.adk.agents import Agent


def read_file(file_path: str) -> dict:
    """
    Read the contents of a file.
    
    Args:
        file_path: Path to the file (absolute or relative to project root)
        
    Returns:
        Dictionary with file contents and metadata
    """
    from .tools.exploration_tools import PROJECT_ROOT
    
    if not os.path.isabs(file_path):
        file_path = os.path.join(PROJECT_ROOT, file_path)
    
    if not os.path.exists(file_path):
        return {"error": f"File not found: {file_path}", "exists": False}
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {
            "path": file_path,
            "exists": True,
            "content": content,
            "line_count": len(content.split('\n'))
        }
    except Exception as e:
        return {"error": str(e), "path": file_path}


def write_file(file_path: str, content: str) -> dict:
    """
    Write content to a file, creating directories if needed.
    
    Args:
        file_path: Path to the file
        content: Content to write
        
    Returns:
        Dictionary with result status
    """
    from .tools.exploration_tools import PROJECT_ROOT
    
    if not os.path.isabs(file_path):
        file_path = os.path.join(PROJECT_ROOT, file_path)
    
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return {
            "success": True,
            "path": file_path,
            "bytes_written": len(content)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def run_tests(test_path: str, timeout: int = 120) -> dict:
    """
    Run pytest on a specific test file or directory.
    
    Args:
        test_path: Path to test file or directory
        timeout: Maximum seconds to wait
        
    Returns:
        Dictionary with test results
    """
    from .tools.exploration_tools import PROJECT_ROOT
    
    if not os.path.isabs(test_path):
        test_path = os.path.join(PROJECT_ROOT, test_path)
    
    try:
        result = subprocess.run(
            ["python", "-m", "pytest", test_path, "-v", "--tb=short"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        return {
            "success": result.returncode == 0,
            "returncode": result.returncode,
            "stdout": result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout,
            "stderr": result.stderr[-500:] if len(result.stderr) > 500 else result.stderr,
            "test_path": test_path
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"Test timeout after {timeout}s"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def check_syntax(file_path: str) -> dict:
    """
    Check Python syntax without executing.
    
    Args:
        file_path: Path to Python file
        
    Returns:
        Dictionary with syntax check result
    """
    from .tools.exploration_tools import PROJECT_ROOT
    
    if not os.path.isabs(file_path):
        file_path = os.path.join(PROJECT_ROOT, file_path)
    
    if not file_path.endswith('.py'):
        return {"valid": True, "message": "Not a Python file, skipping syntax check"}
    
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        compile(content, file_path, 'exec')
        return {"valid": True, "path": file_path}
    except SyntaxError as e:
        return {
            "valid": False,
            "path": file_path,
            "error": str(e),
            "line": e.lineno,
            "offset": e.offset
        }
    except Exception as e:
        return {"valid": False, "error": str(e)}


def git_diff(file_path: Optional[str] = None) -> dict:
    """
    Get git diff for staged or unstaged changes.
    
    Args:
        file_path: Optional specific file to diff
        
    Returns:
        Dictionary with diff output
    """
    from .tools.exploration_tools import PROJECT_ROOT
    
    cmd = ["git", "diff"]
    if file_path:
        if not os.path.isabs(file_path):
            file_path = os.path.join(PROJECT_ROOT, file_path)
        cmd.append(file_path)
    
    try:
        result = subprocess.run(
            cmd,
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        return {
            "success": True,
            "diff": result.stdout[-3000:] if len(result.stdout) > 3000 else result.stdout,
            "file": file_path
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def run_command(command: str, timeout: int = 60) -> dict:
    """
    Run a shell command safely.
    
    Args:
        command: Command to run
        timeout: Maximum seconds to wait
        
    Returns:
        Dictionary with command output
    """
    from .tools.exploration_tools import PROJECT_ROOT
    
    # Safety check - block dangerous commands
    dangerous = ['rm -rf', 'sudo', '> /', 'dd if=', 'mkfs', ':(){']
    if any(d in command.lower() for d in dangerous):
        return {"success": False, "error": "Command blocked for safety"}
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        return {
            "success": result.returncode == 0,
            "returncode": result.returncode,
            "stdout": result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout,
            "stderr": result.stderr[-500:] if len(result.stderr) > 500 else result.stderr
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"Command timeout after {timeout}s"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# Developer Agent - Code implementation
developer_agent = Agent(
    name="developer_agent",
    model="gemini-2.0-flash",
    description="Autonomous code developer that implements improvements",
    instruction="""You are an expert software developer that implements code changes.

## Your Mission:
Implement code changes based on objectives, ensuring quality and test coverage.

## Your Capabilities:

### 1. Code Reading
- Read existing files to understand context
- Understand project patterns and conventions
- Identify related code that might need updates

### 2. Code Writing
- Write clean, well-documented code
- Follow project conventions and patterns
- Add appropriate error handling
- Include docstrings and comments

### 3. Testing
- Run existing tests to verify no regressions
- Create new tests for new functionality
- Ensure all validation commands pass

### 4. Verification
- Check syntax before committing
- Review diffs to ensure changes are correct
- Validate imports and dependencies

## Implementation Workflow:

1. **Understand** - Read the objective and related files
2. **Plan** - Identify what files need to change
3. **Implement** - Make changes one file at a time
4. **Verify** - Check syntax and run tests
5. **Iterate** - Fix any issues and re-verify

## Important Guidelines:

1. **Small Changes**: Make focused, incremental changes
2. **Test First**: Run tests before and after changes
3. **Syntax Check**: Always verify syntax before finishing
4. **No Regressions**: Ensure existing functionality still works
5. **Follow Patterns**: Match the project's coding style

## Example Implementation Flow:

```python
# 1. Read the target file
file = read_file("backend/data_service.py")

# 2. Understand the context (read related files if needed)
tests = read_file("tests/test_data_service.py")

# 3. Make changes
modified_content = add_docstrings(file.content)
write_file("backend/data_service.py", modified_content)

# 4. Check syntax
syntax = check_syntax("backend/data_service.py")
if not syntax.valid:
    # Rollback or fix
    pass

# 5. Run tests
result = run_tests("tests/test_data_service.py")
if not result.success:
    # Debug and fix
    pass
```

## Quality Standards:
- All functions must have docstrings
- Error handling for edge cases
- Type hints where applicable
- Follow PEP 8 for Python
- No hardcoded credentials or secrets
""",
    tools=[
        read_file,
        write_file,
        run_tests,
        check_syntax,
        git_diff,
        run_command,
    ],
)


# Export
__all__ = ["developer_agent", "read_file", "write_file", "run_tests", "check_syntax", "git_diff", "run_command"]
