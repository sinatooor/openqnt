import os
import re
import urllib.request
import urllib.error
import json
import random
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

# Configuration
PPM_ROOT = Path("/Users/sina/project-fire/PPM")
BACKEND_URL = "http://localhost:8000"
ITERATIONS = 30

# Patterns to look for
SUSPICIOUS_PATTERNS = [
    r"TODO",
    r"FIXME",
    r"mock",
    r"placeholder",
    r"console\.log",
    r"alert\(",
    r"Coming soon",
    r"not implemented",
    r"pass\s*#",
]

# Files to ignore
IGNORE_DIRS = ["node_modules", ".git", "__pycache__", "venv", "dist", ".gemini", "coverage"]
IGNORE_EXTS = [".png", ".jpg", ".svg", ".json", ".lock", ".pyc", ".log", ".pq"]

def is_ignored(path):
    for d in IGNORE_DIRS:
        if d in path.parts:
            return True
    if path.suffix in IGNORE_EXTS:
        return True
    return False

def scan_files():
    print(f"🔎 Ralph is scanning {PPM_ROOT}...")
    issues = []
    
    for path in PPM_ROOT.rglob("*"):
        if path.is_file() and not is_ignored(path):
            try:
                # Skip large files (1MB limit)
                if path.stat().st_size > 1_000_000:
                    continue

                content = path.read_text(errors="ignore")
                
                # Check line count
                lines = content.splitlines()
                if len(lines) == 0:
                    issues.append(f"[EMPTY_FILE] {path.relative_to(PPM_ROOT)}")
                    continue

                # Check patterns
                for i, line in enumerate(lines):
                    for pattern in SUSPICIOUS_PATTERNS:
                        if re.search(pattern, line, re.IGNORECASE):
                            # Filter out valid log statements in backend if needed
                            if "console.log" in pattern and "backend" in str(path):
                                continue 
                            issues.append(f"[SUSPICIOUS] {path.relative_to(PPM_ROOT)}:{i+1} - Found '{pattern}' -> {line.strip()[:50]}")
                            
            except Exception as e:
                pass
                
    return issues

def make_request(method, url, data=None):
    try:
        req = urllib.request.Request(url, method=method)
        if data:
            req.add_header('Content-Type', 'application/json')
            req.data = json.dumps(data).encode('utf-8')
        
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        raise e

def fuzz_backend():
    print(f"🌪 Ralph is fuzzing backend {BACKEND_URL} ({ITERATIONS}x)...")
    endpoints = [
        ("GET", "/api/health"),
        ("GET", "/api/mcpt/run"), # Wrong method to test 405
        ("POST", "/api/mcpt/run", {"symbol": "EURUSD", "startDate": "2024-01-01", "endDate": "2024-01-10", "permutations": 10}),
        ("POST", "/verify-backtest", {"xml": "<xml></xml>"}),
    ]
    
    results = []
    
    def hit_endpoint(i):
        method, url, *payload = random.choice(endpoints)
        data = payload[0] if payload else None
        
        full_url = f"{BACKEND_URL}{url}"
        try:
            start = time.time()
            status = make_request(method, full_url, data)
            duration = (time.time() - start) * 1000
            
            if status >= 500:
                return f"[CRITICAL] {method} {url} returned {status} in {duration:.1f}ms"
            elif status >= 400 and status != 404 and status != 405:
                 return f"[WARNING] {method} {url} returned {status} (Client Error?)"
            return None # Success or expected error
        except Exception as e:
            return f"[ERROR] Failed to connect to {url}: {e}"

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(hit_endpoint, i) for i in range(ITERATIONS)]
        for f in futures:
            res = f.result()
            if res:
                results.append(res)
                
    return results

def main():
    print("🤖 Ralph Loop Initiated")
    print("="*40)
    
    # Static Analysis
    file_issues = scan_files()
    
    # Dynamic Analysis
    try:
        backend_issues = fuzz_backend()
    except:
        backend_issues = ["Could not connect to backend"]

    print("\n" + "="*40)
    print("📋 Ralph's Report")
    print("="*40)
    
    print(f"\n🔹 Static Analysis Found {len(file_issues)} issues:")
    for issue in file_issues[:20]: # Limit output
        print(issue)
    if len(file_issues) > 20:
        print(f"... and {len(file_issues) - 20} more.")

    print(f"\n🔹 Dynamic Fuzzing Found {len(backend_issues)} issues:")
    for issue in backend_issues:
        print(issue)
        
    print("\n🏁 Ralph Loop Complete")

if __name__ == "__main__":
    main()
