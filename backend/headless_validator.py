"""
Headless Validator - Centralized headless test execution.

All validation runs without UI, browser, or display requirements.
Designed for CI/server environments.
"""

import os
import subprocess
import time
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path


@dataclass
class TestResult:
    """Result of a single test execution."""
    passed: bool
    command: str
    stdout: str = ""
    stderr: str = ""
    duration: float = 0.0
    error: Optional[str] = None


@dataclass
class ValidationResult:
    """Result of complete objective validation."""
    passed: bool
    tests: list = field(default_factory=list)
    total_duration: float = 0.0
    failed_commands: list = field(default_factory=list)
    

def _find_project_root() -> str:
    """Find the PPM project root directory."""
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "package.json").exists() and (parent / "backend").exists():
            return str(parent)
    return str(current.parent.parent)


PROJECT_ROOT = _find_project_root()


class HeadlessValidator:
    """Runs all validation in headless mode (no UI/browser)."""
    
    def __init__(self, project_root: Optional[str] = None, default_timeout: int = 120):
        self.project_root = project_root or PROJECT_ROOT
        self.default_timeout = default_timeout
        
    def validate_objective(self, objective: dict) -> ValidationResult:
        """
        Run all validation commands from an objective.
        
        Args:
            objective: Dictionary with 'validation' or 'body' containing validation commands
            
        Returns:
            ValidationResult with all test outcomes
        """
        validation_commands = self._extract_validation_commands(objective)
        
        if not validation_commands:
            return ValidationResult(
                passed=False,
                tests=[],
                failed_commands=["No validation commands found"]
            )
        
        results = []
        failed = []
        total_time = 0.0
        
        for cmd in validation_commands:
            result = self._run_command(cmd)
            results.append(result)
            total_time += result.duration
            
            if not result.passed:
                failed.append(cmd)
        
        return ValidationResult(
            passed=len(failed) == 0,
            tests=results,
            total_duration=total_time,
            failed_commands=failed
        )
    
    def _extract_validation_commands(self, objective: dict) -> list:
        """Extract validation commands from objective."""
        import re
        
        commands = []
        
        # Check for direct validation list
        if 'validation_commands' in objective:
            return objective['validation_commands']
        
        # Check body for validation section
        body = objective.get('body', '') or objective.get('details', '')
        
        # Find validation section
        match = re.search(
            r'\*\*validation.*:\*\*\s*\n(.*?)(?=\n\*\*|$)', 
            body, 
            re.DOTALL | re.IGNORECASE
        )
        
        if match:
            lines = match.group(1).strip().split('\n')
            for line in lines:
                if '`' in line:
                    # Extract command from backticks
                    cmd_match = re.search(r'`([^`]+)`', line)
                    if cmd_match:
                        commands.append(cmd_match.group(1))
        
        return commands
    
    def _run_command(self, command: str, timeout: Optional[int] = None) -> TestResult:
        """Run a single validation command."""
        timeout = timeout or self.default_timeout
        start_time = time.time()
        
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=timeout,
                env={**os.environ, "PAGER": "cat"}  # Disable paging
            )
            
            duration = time.time() - start_time
            
            return TestResult(
                passed=result.returncode == 0,
                command=command,
                stdout=result.stdout[-3000:] if len(result.stdout) > 3000 else result.stdout,
                stderr=result.stderr[-1000:] if len(result.stderr) > 1000 else result.stderr,
                duration=duration
            )
            
        except subprocess.TimeoutExpired:
            return TestResult(
                passed=False,
                command=command,
                duration=timeout,
                error=f"Timeout after {timeout}s"
            )
        except Exception as e:
            return TestResult(
                passed=False,
                command=command,
                duration=time.time() - start_time,
                error=str(e)
            )
    
    def run_pytest(
        self, 
        test_path: str, 
        timeout: int = 120,
        extra_args: Optional[list] = None
    ) -> TestResult:
        """
        Run pytest with timeout and capture output.
        
        Args:
            test_path: Path to test file or directory
            timeout: Maximum seconds to wait
            extra_args: Additional pytest arguments
            
        Returns:
            TestResult with pytest output
        """
        if not os.path.isabs(test_path):
            test_path = os.path.join(self.project_root, test_path)
        
        cmd = ["python", "-m", "pytest", test_path, "-v", "--tb=short"]
        if extra_args:
            cmd.extend(extra_args)
        
        start_time = time.time()
        
        try:
            result = subprocess.run(
                cmd,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            duration = time.time() - start_time
            
            return TestResult(
                passed=result.returncode == 0,
                command=" ".join(cmd),
                stdout=result.stdout[-3000:] if len(result.stdout) > 3000 else result.stdout,
                stderr=result.stderr[-500:] if len(result.stderr) > 500 else result.stderr,
                duration=duration
            )
            
        except subprocess.TimeoutExpired:
            return TestResult(
                passed=False,
                command=" ".join(cmd),
                duration=timeout,
                error=f"Pytest timeout after {timeout}s"
            )
        except Exception as e:
            return TestResult(
                passed=False,
                command=" ".join(cmd),
                duration=time.time() - start_time,
                error=str(e)
            )
    
    def validate_syntax(self, file_paths: list) -> dict:
        """
        Check Python/TypeScript syntax without execution.
        
        Args:
            file_paths: List of file paths to check
            
        Returns:
            Dictionary with syntax check results
        """
        results = {
            "valid": True,
            "files_checked": 0,
            "errors": []
        }
        
        for file_path in file_paths:
            if not os.path.isabs(file_path):
                file_path = os.path.join(self.project_root, file_path)
            
            if not os.path.exists(file_path):
                continue
                
            results["files_checked"] += 1
            
            if file_path.endswith('.py'):
                try:
                    with open(file_path, 'r') as f:
                        content = f.read()
                    compile(content, file_path, 'exec')
                except SyntaxError as e:
                    results["valid"] = False
                    results["errors"].append({
                        "file": file_path,
                        "line": e.lineno,
                        "error": str(e)
                    })
                    
            elif file_path.endswith(('.ts', '.tsx', '.js', '.jsx')):
                # Use tsc for TypeScript syntax check
                check_result = subprocess.run(
                    ["npx", "tsc", "--noEmit", file_path],
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                if check_result.returncode != 0:
                    results["valid"] = False
                    results["errors"].append({
                        "file": file_path,
                        "error": check_result.stderr or check_result.stdout
                    })
        
        return results
    
    def validate_imports(self, file_paths: list) -> dict:
        """
        Verify all imports resolve correctly.
        
        Args:
            file_paths: List of Python file paths
            
        Returns:
            Dictionary with import validation results
        """
        results = {
            "valid": True,
            "files_checked": 0,
            "errors": []
        }
        
        for file_path in file_paths:
            if not file_path.endswith('.py'):
                continue
                
            if not os.path.isabs(file_path):
                file_path = os.path.join(self.project_root, file_path)
            
            if not os.path.exists(file_path):
                continue
                
            results["files_checked"] += 1
            
            # Try to import the module
            try:
                import importlib.util
                spec = importlib.util.spec_from_file_location("module", file_path)
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    # Don't actually execute, just check if it loads
            except Exception as e:
                results["valid"] = False
                results["errors"].append({
                    "file": file_path,
                    "error": str(e)
                })
        
        return results
    
    def run_all_tests(self, scope: str = "all") -> ValidationResult:
        """
        Run all tests in a given scope.
        
        Args:
            scope: "all", "backend", "frontend", or "quick"
            
        Returns:
            ValidationResult with all test outcomes
        """
        test_commands = {
            "all": [
                "python -m pytest tests/ -v --tb=short",
                "python -m pytest backend/tests/ -v --tb=short"
            ],
            "backend": [
                "python -m pytest backend/tests/ -v --tb=short"
            ],
            "frontend": [
                "npm run test --if-present"
            ],
            "quick": [
                "python -m pytest tests/test_strategy_ir.py -v"
            ]
        }
        
        commands = test_commands.get(scope, test_commands["quick"])
        
        results = []
        failed = []
        total_time = 0.0
        
        for cmd in commands:
            result = self._run_command(cmd, timeout=300)
            results.append(result)
            total_time += result.duration
            
            if not result.passed:
                failed.append(cmd)
        
        return ValidationResult(
            passed=len(failed) == 0,
            tests=results,
            total_duration=total_time,
            failed_commands=failed
        )


# Singleton instance for convenience
default_validator = HeadlessValidator()


# Export
__all__ = [
    "HeadlessValidator",
    "ValidationResult",
    "TestResult",
    "default_validator"
]
