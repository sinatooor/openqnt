import os
import sys
import pytest
from unittest.mock import MagicMock, patch

# Ensure backend can be imported
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from backend.improve_loop import generate_new_objectives, PlanManager

@pytest.fixture
def mock_plan_manager():
    pm = MagicMock(spec=PlanManager)
    return pm

@patch("backend.improve_loop.call_gemini")
@patch("backend.improve_loop.list_project_files")
def test_generate_new_objectives_adds_todo(mock_list_files, mock_call_gemini, mock_plan_manager):
    # Setup
    mock_list_files.return_value = "file1.py\nfile2.py"
    
    mock_response = """
## Objective 100
**id:** 100
**title:** Improve Logging
**status:** todo
**details:** Add structured logging.
**acceptance_criteria:** Logs are JSON formatted.
**validation:** 
- `python -m pytest tests/test_logging.py`
---
"""
    mock_call_gemini.return_value = mock_response
    
    # Execute
    generate_new_objectives(mock_plan_manager)
    
    # Verify
    mock_plan_manager.append_new.assert_called_once()
    args, _ = mock_plan_manager.append_new.call_args
    content = args[0]
    
    assert "## Objective 100" in content
    assert "**status:** todo" in content
    assert "validation:" in content
    assert "python -m pytest" in content

@patch("backend.improve_loop.call_gemini")
@patch("backend.improve_loop.list_project_files")
def test_generate_no_objectives_if_ai_fails(mock_list_files, mock_call_gemini, mock_plan_manager):
    mock_list_files.return_value = "file1.py"
    mock_call_gemini.return_value = None # AI fails
    
    generate_new_objectives(mock_plan_manager)
    
    mock_plan_manager.append_new.assert_not_called()

def test_plan_manager_parse(tmp_path):
    # Test that PlanManager can parse the format we expect
    tmp_plan = tmp_path / "plan.md"
    content = """
## Objective 10
**id:** 10
**title:** Existing
**status:** done
**details:** ...
**acceptance_criteria:** ...
**validation:** ...
---
"""
    tmp_plan.write_text(content)
    
    pm = PlanManager(str(tmp_plan))
    objs = pm.parse_objectives()
    assert len(objs) == 1
    assert objs[0]['id'] == "10"
    assert objs[0]['status'] == "done"
