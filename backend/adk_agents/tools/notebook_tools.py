"""
Notebook Tools
Provides persistent memory for the agent to save research notes, plans, and observations.
"""
import os
import json
from datetime import datetime
from typing import List, Dict, Optional, Union

# Define storage path
NOTEBOOK_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "user_data", "agent_notebook")

def _ensure_dir():
    if not os.path.exists(NOTEBOOK_DIR):
        os.makedirs(NOTEBOOK_DIR)

def save_note(title: str, content: str, category: str = "general") -> str:
    """
    Save a new note or overwrite an existing one.
    
    Args:
        title: Title of the note (used as filename)
        content: The text content of the note
        category: Tag/Category for organization
    """
    try:
        _ensure_dir()
        filename = f"{title.lower().replace(' ', '_')}.json"
        filepath = os.path.join(NOTEBOOK_DIR, filename)
        
        note = {
            "title": title,
            "category": category,
            "content": content,
            "updated_at": datetime.now().isoformat(),
            "created_at": datetime.now().isoformat()
        }
        
        # Preserve creation time if exists
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r') as f:
                    old_note = json.load(f)
                    note["created_at"] = old_note.get("created_at", note["created_at"])
            except:
                pass
                
        with open(filepath, 'w') as f:
            json.dump(note, f, indent=2)
            
        return f"Note '{title}' saved successfully."
    except Exception as e:
        return f"Error saving note: {str(e)}"

def read_note(title: str) -> str:
    """Read a specific note by title."""
    try:
        filename = f"{title.lower().replace(' ', '_')}.json"
        filepath = os.path.join(NOTEBOOK_DIR, filename)
        
        if not os.path.exists(filepath):
            return f"Note '{title}' not found."
            
        with open(filepath, 'r') as f:
            note = json.load(f)
            
        return f"# {note['title']} ({note['category']})\nLast Updated: {note['updated_at']}\n\n{note['content']}"
    except Exception as e:
        return f"Error reading note: {str(e)}"

def list_notes(category: Optional[str] = None) -> str:
    """List all available notes, optionally filtered by category."""
    try:
        _ensure_dir()
        notes = []
        for filename in os.listdir(NOTEBOOK_DIR):
            if filename.endswith(".json"):
                try:
                    with open(os.path.join(NOTEBOOK_DIR, filename), 'r') as f:
                        note = json.load(f)
                        if category and note.get("category") != category:
                            continue
                        notes.append(f"- {note['title']} ({note.get('category', 'general')}) - {note.get('updated_at', '')[:10]}")
                except:
                    continue
                    
        if not notes:
            return "No notes found."
            
        return "\n".join(notes)
    except Exception as e:
        return f"Error listing notes: {str(e)}"

def append_to_note(title: str, content: str) -> str:
    """Append text to an existing note."""
    try:
        filename = f"{title.lower().replace(' ', '_')}.json"
        filepath = os.path.join(NOTEBOOK_DIR, filename)
        
        if not os.path.exists(filepath):
            return f"Note '{title}' not found. Use save_note to create it."
            
        with open(filepath, 'r') as f:
            note = json.load(f)
            
        note["content"] += f"\n\n{content}"
        note["updated_at"] = datetime.now().isoformat()
        
        with open(filepath, 'w') as f:
            json.dump(note, f, indent=2)
            
        return f"Appended to '{title}'."
    except Exception as e:
        return f"Error appending to note: {str(e)}"

__all__ = ["save_note", "read_note", "list_notes", "append_to_note"]
