#!/usr/bin/env python3
import os
import sys
import subprocess
import time
import re
import json
from datetime import datetime
import signal
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# --- Configuration ---
PLAN_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../plan.md"))
REPO_ROOT = os.path.dirname(PLAN_FILE)
MAX_RETRIES = 10
GEMINI_MODEL = "gemini-3-pro-preview"
PAUSE_FILE = os.path.join(REPO_ROOT, ".pause_improve_loop")
AI_TIMEOUT = 900 # 15 minutes

# --- Utils ---
LOG_FILE = os.path.join(REPO_ROOT, "improve_loop.log")

def log(msg):
    timestamp = datetime.now().strftime('%H:%M:%S')
    line = f"[{timestamp}] {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except:
        pass

def run_cmd(cmd, cwd=REPO_ROOT, timeout=300):
    log(f"CMD START: {cmd}")
    try:
        # Check for pause
        while os.path.exists(PAUSE_FILE):
             log("Paused... (remove .pause_improve_loop to continue)")
             time.sleep(5)

        process = subprocess.Popen(
            cmd, shell=True, cwd=cwd,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True
        )
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            process.kill()
            log(f"CMD TIMEOUT ({timeout}s): {cmd}")
            return False, "", "Timeout"

        if process.returncode != 0:
            log(f"CMD FAILED (Exit {process.returncode})")
            return False, stdout, stderr
        
        log(f"CMD SUCCESS")
        return True, stdout, stderr
    except Exception as e:
        log(f"CMD EXCEPTION: {e}")
        return False, "", str(e)

def call_gemini(prompt):
    log(f"AI: Querying {GEMINI_MODEL} (Prompt: {len(prompt)/1024:.1f} KB)...")
    # Save for debugging
    try:
        with open(os.path.join(REPO_ROOT, ".last_prompt"), "w") as f:
            f.write(prompt)
    except:
        pass
        
    try:
        cmd = ["gemini", "-m", GEMINI_MODEL, "--output-format", "text"]
        
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=REPO_ROOT,
            preexec_fn=os.setsid
        )
        log(f"AI: Communicating (Timeout: {AI_TIMEOUT}s)...")
        try:
            stdout, stderr = process.communicate(input=prompt, timeout=AI_TIMEOUT)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
            except:
                pass
            log(f"AI TIMEOUT ({AI_TIMEOUT}s)")
            return None
        
        if process.returncode != 0:
            log(f"AI Error (Exit {process.returncode}): {stderr.strip()}")
            return None
        log("AI: Response received.")
        # Save for debugging
        try:
            with open(os.path.join(REPO_ROOT, ".last_ai_response"), "w") as f:
                f.write(stdout)
        except:
            pass
        return stdout.strip()
    except Exception as e:
        log(f"AI Exception: {e}")
        return None

def git_commit(oid, title):
    msg = f"objective {oid}: {title}"
    run_cmd("git add -A")
    success, _, err = run_cmd(f"git commit -m \"{msg}\"")
    if success:
        log(f"Git Committed: {msg}")
    else:
        log(f"Git Commit Failed: {err}")

def list_project_files():
    # Helper to list git files or relevant source files
    success, out, _ = run_cmd("git ls-files", cwd=REPO_ROOT)
    if success:
        return out
    else:
        # Fallback to os walk
        files = []
        for root, _, fs in os.walk(REPO_ROOT):
            if ".git" in root or "venv" in root or "node_modules" in root: continue
            for f in fs:
                if f.endswith(('.py', '.ts', '.tsx', '.js', '.md', '.json', '.html')):
                    files.append(os.path.relpath(os.path.join(root, f), REPO_ROOT))
        return "\n".join(files)

# --- Plan Manager ---
class PlanManager:
    def __init__(self, path):
        self.path = path

    def read(self):
        if not os.path.exists(self.path):
            return ""
        with open(self.path, 'r') as f:
            return f.read()
    
    def write(self, content):
        with open(self.path, 'w') as f:
            f.write(content)

    def parse_objectives(self):
        content = self.read()
        objs = []
        # Find ## Objective blocks
        pattern = re.compile(r'## Objective\s+(\d+)(.*?)(?=\n## Objective|\n---|$)', re.DOTALL)
        for match in pattern.finditer(content):
            oid = match.group(1)
            body = match.group(2)
            
            # Extract fields
            title_m = re.search(r'\*\*title:\*\*\s*(.+)', body)
            status_m = re.search(r'\*\*status:\*\*\s*(\w+)', body)
            
            objs.append({
                "id": oid,
                "title": title_m.group(1).strip() if title_m else "Unknown",
                "status": status_m.group(1).strip() if status_m else "unknown",
                "body": body,
                "full_match": match.group(0)
            })
        return objs

    def update_status(self, oid, status, notes=None):
        content = self.read()
        # Regex replacement specific to the ID block
        # Look for **status:** inside the block for this ID
        # We construct a regex that matches the header and then finds status
        
        # Safer way: Locate the block by ID, then replace status inside it
        pattern = re.compile(rf'(## Objective\s+{oid}.*?)(\*\*status:\*\*\s*\w+)', re.DOTALL)
        
        def replacer(m):
            head = m.group(1)
            new_text = f"{head}**status:** {status}"
            if notes:
                 new_text += f"\n\n**notes:** {notes}"
            return new_text

        new_content = pattern.sub(replacer, content, count=1)
        self.write(new_content)

    def get_next_id(self):
        objs = self.parse_objectives()
        if not objs:
            return 100
        ids = []
        for o in objs:
            try:
                ids.append(int(o['id']))
            except:
                pass
        return max(ids) + 1 if ids else 100

    def append_new(self, text):
        content = self.read()
        self.write(content.rstrip() + "\n\n" + text + "\n")

# --- Processing ---

def extract_validations(body):
    # Find validation section
    # Match "**validation...:**" (case insensitive)
    match = re.search(r'\*\*validation.*\:\*\*\s*\n(.*?)(?=\n\*\*|\n---|$)', body, re.DOTALL | re.IGNORECASE)
    if not match: return []
    lines = match.group(1).strip().split('\n')
    cmds = []
    for line in lines:
        if "`" in line:
            # Extract code block `cmd`
            cmd = line.split("`")[1]
            cmds.append(cmd)
    return cmds

def get_file_content(path):
    full_path = os.path.join(REPO_ROOT, path)
    if os.path.exists(full_path):
        with open(full_path, 'r') as f:
            return f.read()
    return "(File not found)"

def apply_changes(changes_text):
    # Format:
    # FILE: path/to/file
    # ```
    # content
    # ```
    
    # More robust parsing:
    # 1. Split into chunks by FILE:
    chunks = re.split(r'^FILE:\s*', changes_text, flags=re.MULTILINE)
    applied_count = 0
    
    for chunk in chunks:
        if not chunk.strip(): continue
        
        # 2. In each chunk, match path and code block
        # Path is everything until the first newline
        lines = chunk.split('\n', 1)
        if len(lines) < 2: continue
        
        path = lines[0].strip()
        body = lines[1]
        
        # Extract content between the FIRST and LAST ``` in the body
        # This handles cases where the code itself contains ``` for markdown
        first_tick = body.find('```')
        last_tick = body.rfind('```')
        
        if first_tick == -1 or last_tick == -1 or first_tick == last_tick:
            continue
            
        # Find the newline after the first ```
        start_content = body.find('\n', first_tick)
        if start_content == -1 or start_content > last_tick:
            continue
        
        content = body[start_content+1:last_tick].strip()
        
        # Security/Sanity check
        if len(path) > 255 or any(c in path for c in ['\n', '\r', ':', '*', '?', '"', '<', '>', '|']):
            log(f"Skipping invalid file path: {path}")
            continue

        full_path = os.path.join(REPO_ROOT, path)
        applied_count += 1
        try:
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'w') as f:
                f.write(content)
            log(f"Updated file: {path}")
        except Exception as e:
            log(f"Error writing file {path}: {e}")
            
    return applied_count > 0

def process_objective(pm, obj):
    log(f"Processing Objective {obj['id']}: {obj['title']}")
    
    validations = extract_validations(obj['body'])
    if not validations:
        log("No validations found! Verify plan.md format.")
        return False

    files_list = list_project_files()
    
    # Retry Loop
    last_error = ""
    for attempt in range(MAX_RETRIES):
        log(f"Attempt {attempt+1}/{MAX_RETRIES}...")
        
        # 1. Identify Context
        prompt_1 = f"""
You are an Autonomous Developer.
Objective:
{obj['title']}
{obj['body']}

Project Files:
{files_list}

Identify which files need to be read or created to implement this.
Return ONLY a comma-separated list of file paths.
"""
        target_files_str = call_gemini(prompt_1)
        if not target_files_str: continue
        
        target_files = [f.strip() for f in target_files_str.replace('\n', ',').split(',') if f.strip()]
        
        # 2. Read Files
        file_contents = ""
        for tf in target_files:
            file_contents += f"\n--- {tf} ---\n{get_file_content(tf)}\n"

        # 3. Implement
        prompt_2 = f"""
You are an Autonomous Developer.
Objective: {obj['title']}
Details:
{obj['body']}

Context Files:
{file_contents}

Previous Error (if any):
{last_error}

Task: Implement the objective.
Rules:
- Output the FULL content of any modified/created files.
- Use the following format for EACH file:
FILE: <path>
```
<content>
```
- Do not include explanatory text outside the blocks.
"""
        changes = call_gemini(prompt_2)
        if not changes: continue
        
        applied = apply_changes(changes)
        if not applied:
            log("Failed to apply changes (parsing error?).")
            continue
            
        # 4. Validate
        all_passed = True
        for cmd in validations:
            success, out, err = run_cmd(cmd)
            if not success:
                all_passed = False
                last_error = f"Command failed: {cmd}\nStdout: {out}\nStderr: {err}"
                log(f"Validation failed: {cmd}")
                break
        
        if all_passed:
            log("Validation Passed!")
            return True
            
    # Failed after retries
    pm.update_status(obj['id'], 'blocked', notes=last_error)
    return False

def generate_new_objectives(pm):
    log("Continuous Improvement: Generating new objectives...")
    file_tree = list_project_files()
    next_id = pm.get_next_id()
    prompt = f"""
Analyze this repository and propose 3–5 high-impact improvements.
Project Files:
{file_tree}

For each, include:
- why it matters
- concrete acceptance criteria
- a headless validation method

Filter out vague or untestable suggestions.

Format your response strictly as new 'plan.md' entries.
Example:
## Objective <next_id>
**id:** <next_id>
**title:** ...
**status:** todo
**details:** ...
**acceptance_criteria:** ...
**validation:** ...
---

Ensure validation commands are realistic.
Start IDs from {next_id}.
"""
    new_objs = call_gemini(prompt)
    if new_objs and "## Objective" in new_objs:
        pm.append_new(new_objs)
        log("Added new objectives to plan.md")
    else:
        log("No valid objectives generated.")

# --- Main Loop ---
def main():
    log("Starting Autonomous Improvement Loop...")
    pm = PlanManager(PLAN_FILE)
    
    while True:
        # Reload plan
        objs = pm.parse_objectives()
        
        # Verify plan.md exists and is readable
        if not objs and not os.path.exists(PLAN_FILE):
             log("plan.md not found!")
             time.sleep(10)
             continue

        # Find Todo
        todo = next((o for o in objs if o['status'].lower() == 'todo'), None)
        
        if todo:
            pm.update_status(todo['id'], 'doing')
            success = process_objective(pm, todo)
            
            if success:
                pm.update_status(todo['id'], 'done')
                git_commit(todo['id'], todo['title'])
            else:
                log(f"Objective {todo['id']} failed/blocked.")
        else:
            if not any(o['status'].lower() == 'doing' for o in objs):
                generate_new_objectives(pm)
            else:
                log("Waiting for manual intervention or new tasks...")
                time.sleep(10)
        
        time.sleep(2)

if __name__ == "__main__":
    main()