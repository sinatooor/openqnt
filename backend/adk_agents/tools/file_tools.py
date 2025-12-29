import os
import subprocess
from typing import List, Optional

def read_file(path: str) -> str:
    """Reads the content of a file at the given path."""
    try:
        if not os.path.isabs(path):
            path = os.path.abspath(path)
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file {path}: {str(e)}"

def write_file(path: str, content: str) -> str:
    """Writes content to a file at the given path. Overwrites if exists."""
    try:
        if not os.path.isabs(path):
            path = os.path.abspath(path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"Successfully wrote to {path}"
    except Exception as e:
        return f"Error writing file {path}: {str(e)}"

def list_dir(path: str = ".") -> str:
    """Lists files and directories in the given path."""
    try:
        if not os.path.isabs(path):
            path = os.path.abspath(path)
        items = os.listdir(path)
        return "\n".join(items)
    except Exception as e:
        return f"Error listing directory {path}: {str(e)}"

def run_terminal_command(command: str) -> str:
    """Executes a terminal command and returns stdout + stderr."""
    try:
        # Safety check: Prevent interactive commands? 
        # For now, we trust the agent as requested "YOLO".
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=120 # 2 minute timeout
        )
        output = f"Exit Code: {result.returncode}\n"
        output += f"STDOUT:\n{result.stdout}\n"
        if result.stderr:
            output += f"STDERR:\n{result.stderr}\n"
        return output
    except Exception as e:
        return f"Error executing command '{command}': {str(e)}"
