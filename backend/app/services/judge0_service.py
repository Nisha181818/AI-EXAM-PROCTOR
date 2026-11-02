import httpx
import asyncio
import time
import subprocess
import tempfile
import sys
from typing import List, Dict, Any, Optional
from app.config import settings

LANGUAGE_IDS = {
    "python": 71,       # Python 3
    "python3": 71,
    "javascript": 63,   # Node.js
    "java": 62,         # Java
    "cpp": 54,          # C++
    "c": 50,            # C
}


def get_headers() -> dict:
    headers = {
        "Content-Type": "application/json",
    }
    # RapidAPI Judge0 authentication headers
    if settings.judge0_api_key:
        headers["x-rapidapi-key"] = settings.judge0_api_key
        headers["x-rapidapi-host"] = settings.judge0_api_host
    elif settings.judge0_auth_token:
        headers["X-Auth-Token"] = settings.judge0_auth_token
    return headers


async def submit_code(
    source_code: str,
    language: str = "python",
    stdin: str = "",
    expected_output: Optional[str] = None,
) -> str:
    language_id = LANGUAGE_IDS.get(language.lower(), 71)

    payload = {
        "source_code": source_code,
        "language_id": language_id,
        "stdin": stdin,
        "expected_output": expected_output,
        "cpu_time_limit": 5,
        "memory_limit": 256000,
    }

    url = f"{settings.judge0_url.rstrip('/')}/submissions?base64_encoded=false&wait=false"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, json=payload, headers=get_headers())
        resp.raise_for_status()
        return resp.json()["token"]


async def get_submission_result(token: str, max_wait_seconds: int = 15) -> Dict[str, Any]:
    start = time.time()
    url = f"{settings.judge0_url.rstrip('/')}/submissions/{token}?base64_encoded=false"

    async with httpx.AsyncClient(timeout=15.0) as client:
        while time.time() - start < max_wait_seconds:
            resp = await client.get(url, headers=get_headers())
            resp.raise_for_status()
            data = resp.json()
            status_id = data.get("status", {}).get("id", 1)
            # Status IDs: 1=In Queue, 2=Processing, 3=Accepted, 4+=Error
            if status_id not in (1, 2):
                return data
            await asyncio.sleep(0.8)

    return {"status": {"id": 0, "description": "Timeout"}, "stdout": None, "stderr": "Execution Timeout"}


def run_code_locally(source_code: str, stdin: str = "", timeout: int = 5) -> Dict[str, Any]:
    """Fallback runner if Judge0 RapidAPI limit is reached or offline."""
    try:
        with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False, encoding="utf-8") as f:
            f.write(source_code)
            tmp_path = f.name

        proc = subprocess.run(
            [sys.executable, tmp_path],
            input=stdin,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        try:
            import os
            os.unlink(tmp_path)
        except Exception:
            pass

        return {
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "status": {
                "id": 3 if proc.returncode == 0 else 11,
                "description": "Accepted" if proc.returncode == 0 else "Runtime Error"
            },
            "time": "0.1",
            "memory": 1024,
        }
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Time limit exceeded", "status": {"id": 5, "description": "Time Limit Exceeded"}}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "status": {"id": 11, "description": f"Error: {e}"}}


async def run_test_cases(
    source_code: str,
    test_cases: List[Dict[str, Any]],
    language: str = "python",
) -> List[Dict[str, Any]]:
    results = []

    for i, tc in enumerate(test_cases):
        stdin = str(tc.get("input", ""))
        expected = str(tc.get("expected", "")).strip()

        try:
            token = await submit_code(source_code, language, stdin, expected)
            result = await get_submission_result(token)
        except Exception as e:
            # Fallback to local runner if RapidAPI is unconfigured or rate-limited
            print(f"Judge0 RapidAPI notice ({e}), using local sandbox fallback")
            result = run_code_locally(source_code, stdin)

        actual_output = (result.get("stdout") or "").strip()
        status_id = result.get("status", {}).get("id", 0)
        passed = (status_id == 3 or status_id == 0) and actual_output == expected

        results.append({
            "test_case_index": i,
            "input": stdin,
            "expected": expected,
            "actual": actual_output,
            "passed": passed,
            "status": result.get("status", {}).get("description", "Unknown"),
            "time": result.get("time"),
            "memory": result.get("memory"),
            "stderr": result.get("stderr") or result.get("compile_output") or "",
        })

    return results


def compute_coding_score(test_results: List[Dict[str, Any]]) -> float:
    if not test_results:
        return 0.0
    passed = sum(1 for r in test_results if r.get("passed"))
    return round((passed / len(test_results)) * 100, 2)
