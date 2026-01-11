"""
Agent Orchestrator - Coordinates multi-agent workflow for continuous improvement.

Manages the interaction between exploratory and developer agents,
handling the improvement lifecycle from discovery to implementation.
"""

import os
import re
import subprocess
import time
import json
from datetime import datetime
from typing import Optional
from pathlib import Path


def _find_project_root() -> str:
    """Find the PPM project root directory."""
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "package.json").exists() and (parent / "backend").exists():
            return str(parent)
    return str(current.parent.parent)


PROJECT_ROOT = _find_project_root()
LOG_FILE = os.path.join(PROJECT_ROOT, "improve_loop.log")


def log(msg: str):
    """Log a message to console and file."""
    timestamp = datetime.now().strftime('%H:%M:%S')
    line = f"[{timestamp}] {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except:
        pass


class AgentOrchestrator:
    """Orchestrates multi-agent workflow for continuous improvement."""
    
    def __init__(self, project_root: Optional[str] = None):
        self.project_root = project_root or PROJECT_ROOT
        self.plan_path = os.path.join(self.project_root, "plan.md")
        self.metrics = {
            "cycles_completed": 0,
            "improvements_made": 0,
            "failures": 0,
            "start_time": datetime.now().isoformat()
        }
    
    def run_exploration_cycle(self) -> Optional[dict]:
        """
        Run a single exploration cycle to discover improvements.
        
        Returns:
            Dictionary with discovered opportunity, or None
        """
        log("🔍 Starting exploration cycle...")
        
        try:
            from adk_agents.tools.exploration_tools import (
                find_improvement_opportunities,
                get_test_coverage_gaps,
                analyze_dependencies
            )
            
            # 1. Find improvement opportunities
            opportunities = find_improvement_opportunities(scope="all")
            
            if not opportunities:
                log("No opportunities found in this cycle")
                return None
            
            # 2. Filter for actionable items (priority >= 5)
            actionable = [o for o in opportunities if o.get("priority", 0) >= 5]
            
            if not actionable:
                log("No high-priority opportunities found")
                return None
            
            # 3. Return highest priority opportunity
            top = actionable[0]
            log(f"📌 Found opportunity: {top.get('description', 'Unknown')}")
            
            return top
            
        except Exception as e:
            log(f"❌ Exploration error: {e}")
            return None
    
    def generate_objective_from_opportunity(self, opportunity: dict) -> Optional[str]:
        """
        Generate a plan.md objective from an opportunity.
        
        Args:
            opportunity: Dictionary with improvement details
            
        Returns:
            Markdown objective string, or None
        """
        from adk_agents.tools.exploration_tools import generate_plan_objective
        
        opp_type = opportunity.get("type", "unknown")
        file_path = opportunity.get("file", "")
        description = opportunity.get("description", "Improvement needed")
        priority = opportunity.get("priority", 5)
        
        # Generate appropriate validation commands
        validation_commands = self._generate_validation_commands(opp_type, file_path)
        
        # Build objective details
        details = f"""
{description}

**File:** `{file_path}`
**Action:** {opportunity.get('action', 'Implement improvement')}
**Details:** {json.dumps(opportunity.get('details', {}), indent=2) if opportunity.get('details') else 'N/A'}
"""
        
        objective = generate_plan_objective(
            title=description[:100],  # Truncate long titles
            details=details.strip(),
            validation_commands=validation_commands,
            priority=priority
        )
        
        return objective
    
    def _generate_validation_commands(self, opp_type: str, file_path: str) -> list:
        """Generate appropriate validation commands for an opportunity type."""
        commands = []
        
        # Always include syntax check for Python files
        if file_path.endswith('.py'):
            commands.append(f"python -c \"import ast; ast.parse(open('{file_path}').read())\"")
        
        # Type-specific validations
        if opp_type == "todo_items":
            # Run related tests if they exist
            test_file = self._find_related_test(file_path)
            if test_file:
                commands.append(f"python -m pytest {test_file} -v")
            commands.append("python -m pytest tests/ -v --tb=short -x")
            
        elif opp_type == "missing_documentation":
            commands.append(f"python -c \"import ast; ast.parse(open('{file_path}').read())\"")
            
        elif opp_type == "syntax_error":
            commands.append(f"python -c \"import ast; ast.parse(open('{file_path}').read())\"")
            
        elif opp_type == "large_file":
            commands.append("python -m pytest tests/ -v --tb=short")
            
        else:
            # Default: run all tests
            commands.append("python -m pytest tests/ -v --tb=short -x")
        
        return commands
    
    def _find_related_test(self, file_path: str) -> Optional[str]:
        """Find test file related to a source file."""
        basename = os.path.basename(file_path).replace('.py', '')
        
        possible_tests = [
            f"tests/test_{basename}.py",
            f"backend/tests/test_{basename}.py",
            f"backend/test_{basename}.py"
        ]
        
        for test in possible_tests:
            full_path = os.path.join(self.project_root, test)
            if os.path.exists(full_path):
                return test
        
        return None
    
    def implement_objective(self, objective: dict) -> dict:
        """
        Implement an objective using the developer agent.
        
        Args:
            objective: Parsed objective dictionary
            
        Returns:
            Dictionary with implementation result
        """
        log(f"💻 Implementing: {objective.get('title', 'Unknown')}")
        
        from headless_validator import HeadlessValidator
        validator = HeadlessValidator(self.project_root)
        
        # 1. Call Gemini to implement changes
        changes = self._call_gemini_for_implementation(objective)
        
        if not changes:
            return {"success": False, "error": "Failed to generate implementation"}
        
        # 2. Apply changes
        applied = self._apply_changes(changes)
        
        if not applied:
            return {"success": False, "error": "Failed to apply changes"}
        
        # 3. Validate
        validation = validator.validate_objective(objective)
        
        if validation.passed:
            log("✅ Validation passed!")
            return {
                "success": True,
                "validation": validation,
                "changes": changes
            }
        else:
            log(f"❌ Validation failed: {validation.failed_commands}")
            self._rollback_changes()
            return {
                "success": False,
                "error": "Validation failed",
                "failed_commands": validation.failed_commands
            }
    
    def _call_gemini_for_implementation(self, objective: dict) -> Optional[str]:
        """Call Gemini to generate implementation code."""
        from adk_agents.tools.exploration_tools import PROJECT_ROOT
        
        # Get file list
        result = subprocess.run(
            ["git", "ls-files"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True
        )
        files_list = result.stdout if result.returncode == 0 else ""
        
        # Build prompt
        prompt = f"""
You are an Autonomous Developer.
Objective: {objective.get('title', 'Unknown')}
Details:
{objective.get('body', objective.get('details', ''))}

Project Files:
{files_list[:5000]}

Task: Implement this objective.
Rules:
- Output the FULL content of any modified/created files.
- Use the following format for EACH file:
FILE: <path>
```
<content>
```
- Do not include explanatory text outside the blocks.
"""
        
        try:
            cmd = ["gemini", "-m", "gemini-3-pro-preview", "--output-format", "text"]
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=PROJECT_ROOT
            )
            stdout, stderr = process.communicate(input=prompt, timeout=180)
            
            if process.returncode != 0:
                log(f"Gemini error: {stderr}")
                return None
            
            return stdout.strip()
        except Exception as e:
            log(f"Gemini exception: {e}")
            return None
    
    def _apply_changes(self, changes_text: str) -> bool:
        """Apply file changes from Gemini response."""
        pattern = re.compile(r'^FILE:\s*(.+?)\s*$\n```\w*\n(.*?)```', re.DOTALL | re.MULTILINE)
        matches = pattern.findall(changes_text)
        
        if not matches:
            log("No valid FILE blocks found")
            return False
        
        for path, content in matches:
            path = path.strip()
            full_path = os.path.join(self.project_root, path)
            
            try:
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, 'w') as f:
                    f.write(content)
                log(f"📝 Updated: {path}")
            except Exception as e:
                log(f"Error writing {path}: {e}")
                return False
        
        return True
    
    def _rollback_changes(self):
        """Rollback uncommitted changes."""
        subprocess.run(
            ["git", "checkout", "."],
            cwd=self.project_root,
            capture_output=True
        )
        log("🔄 Changes rolled back")
    
    def git_commit(self, objective: dict):
        """Commit successful changes."""
        msg = f"Auto-improve: {objective.get('title', 'improvement')[:50]}"
        
        subprocess.run(["git", "add", "-A"], cwd=self.project_root)
        result = subprocess.run(
            ["git", "commit", "-m", msg],
            cwd=self.project_root,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            log(f"📦 Committed: {msg}")
            self.metrics["improvements_made"] += 1
        else:
            log(f"Git commit failed: {result.stderr}")
    
    def add_objective_to_plan(self, objective_md: str):
        """Append a new objective to plan.md."""
        with open(self.plan_path, 'a') as f:
            f.write("\n" + objective_md)
        log("📋 Added new objective to plan.md")
    
    def run_full_cycle(self) -> bool:
        """
        Run a complete improvement cycle.
        
        Returns:
            True if an improvement was made, False otherwise
        """
        self.metrics["cycles_completed"] += 1
        log(f"🔄 Cycle {self.metrics['cycles_completed']} starting...")
        
        # 1. Explore
        opportunity = self.run_exploration_cycle()
        if not opportunity:
            return False
        
        # 2. Generate objective
        objective_md = self.generate_objective_from_opportunity(opportunity)
        if not objective_md:
            return False
        
        # 3. Parse objective for implementation
        objective = {
            "title": opportunity.get("description", "Improvement"),
            "body": objective_md,
            "details": opportunity.get("details", {})
        }
        
        # 4. Implement
        result = self.implement_objective(objective)
        
        if result.get("success"):
            self.git_commit(objective)
            return True
        else:
            self.metrics["failures"] += 1
            return False


# Singleton instance
default_orchestrator = AgentOrchestrator()


# Export
__all__ = ["AgentOrchestrator", "default_orchestrator", "log"]
