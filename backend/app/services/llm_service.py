import json
import re
from typing import List, Dict, Any, Optional
import httpx
from app.config import settings


class LLMClient:
    def __init__(self):
        pass

    @property
    def provider(self) -> str:
        prov = (settings.llm_provider or "").lower()
        # Auto-detect provider based on available non-placeholder keys
        if prov in ("gemini", "google") and self._has_gemini():
            return "gemini"
        if prov == "groq" and self._has_groq():
            return "groq"
        if prov == "openai" and self._has_openai():
            return "openai"
        if prov == "anthropic" and self._has_anthropic():
            return "anthropic"

        # Fallback to whatever key is actually set
        if self._has_gemini():
            return "gemini"
        if self._has_groq():
            return "groq"
        if self._has_openai():
            return "openai"
        if self._has_anthropic():
            return "anthropic"

        return prov or "mock"

    def _has_gemini(self) -> bool:
        k = settings.gemini_api_key
        return bool(k and not k.startswith("placeholder") and len(k) > 10)

    def _has_groq(self) -> bool:
        k = settings.groq_api_key
        return bool(k and not k.startswith("gsk_placeholder") and len(k) > 10)

    def _has_openai(self) -> bool:
        k = settings.openai_api_key
        return bool(k and not k.startswith("sk-placeholder") and len(k) > 10)

    def _has_anthropic(self) -> bool:
        k = settings.anthropic_api_key
        return bool(k and not k.startswith("sk-ant-placeholder") and len(k) > 10)

    async def chat(self, messages: List[Dict[str, str]], temperature: float = 0.3) -> str:
        active_provider = self.provider

        if active_provider == "gemini":
            try:
                return await self._gemini_chat(messages, temperature)
            except Exception as e:
                print(f"[LLM] Gemini error: {e}, attempting fallbacks...")

        elif active_provider == "groq":
            try:
                return await self._groq_chat(messages, temperature)
            except Exception as e:
                print(f"[LLM] Groq error: {e}, attempting fallbacks...")

        elif active_provider == "openai":
            try:
                return await self._openai_chat(messages, temperature)
            except Exception as e:
                print(f"[LLM] OpenAI error: {e}, attempting fallbacks...")

        elif active_provider == "anthropic":
            try:
                return await self._anthropic_chat(messages, temperature)
            except Exception as e:
                print(f"[LLM] Anthropic error: {e}, attempting fallbacks...")

        # If chosen provider failed, try any secondary available provider
        for alt_provider, test_fn, call_fn in [
            ("gemini", self._has_gemini, self._gemini_chat),
            ("groq", self._has_groq, self._groq_chat),
            ("openai", self._has_openai, self._openai_chat),
            ("anthropic", self._has_anthropic, self._anthropic_chat),
        ]:
            if alt_provider != active_provider and test_fn():
                try:
                    return await call_fn(messages, temperature)
                except Exception as e:
                    print(f"[LLM] Fallback {alt_provider} error: {e}")

        # Rule-based fallback when no valid API key is available
        return self._fallback_response(messages)

    async def _gemini_chat(self, messages: List[Dict[str, str]], temperature: float) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
        
        system_instruction = None
        contents = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role == "system":
                system_instruction = {"parts": [{"text": content}]}
            elif role == "assistant":
                contents.append({"role": "model", "parts": [{"text": content}]})
            else:
                contents.append({"role": "user", "parts": [{"text": content}]})

        body: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 2048,
            }
        }
        if system_instruction:
            body["systemInstruction"] = system_instruction

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "").strip()
        raise ValueError("Empty response received from Gemini API")

    async def _groq_chat(self, messages: List[Dict[str, str]], temperature: float) -> str:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": settings.groq_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 2048,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()

    async def _openai_chat(self, messages: List[Dict[str, str]], temperature: float) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            temperature=temperature,
            max_tokens=2048,
        )
        return response.choices[0].message.content.strip()

    async def _anthropic_chat(self, messages: List[Dict[str, str]], temperature: float) -> str:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        system_msg = ""
        filtered = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            else:
                filtered.append(m)
        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=2048,
            temperature=temperature,
            system=system_msg if system_msg else anthropic.NOT_GIVEN,
            messages=filtered,
        )
        return response.content[0].text.strip()

    def _fallback_response(self, messages: List[Dict[str, str]]) -> str:
        content = " ".join([m["content"] for m in messages]).lower()
        full_text = " ".join([m.get("content", "") for m in messages])

        # Viva evaluation fallback: NEVER give full marks or high confidence if no LLM key!
        if "confidence" in content or "oral exam" in content or "viva question" in content:
            student_ans = ""
            for m in messages:
                c = m.get("content", "")
                if "STUDENT'S ANSWER:" in c:
                    student_ans = c.split("STUDENT'S ANSWER:")[1].strip()
                elif "Student's Answer:" in c:
                    student_ans = c.split("Student's Answer:")[1].strip()

            clean_ans = student_ans.lower().strip()
            # If answer is empty or too short
            if not clean_ans or len(clean_ans) < 15 or clean_ans in ("no", "yes", "i don't know", "dont know", "n/a", "none"):
                return json.dumps({
                    "confidence": "low",
                    "score": 0.0,
                    "reasoning": "Answer is absent, evasive, or too brief to demonstrate understanding (Rule-based check; no LLM provider configured)."
                })
            elif len(clean_ans) < 40:
                return json.dumps({
                    "confidence": "low",
                    "score": 25.0,
                    "reasoning": "Answer lacks technical explanation and reasoning (Rule-based check; no LLM provider configured)."
                })
            else:
                # Moderate response without LLM verification: give conservative medium confidence (never high/full marks)
                return json.dumps({
                    "confidence": "medium",
                    "score": 50.0,
                    "reasoning": "Basic response recorded. Conservative partial credit assigned (No LLM API key configured on server)."
                })

        elif "rubric" in content or "grade the student's answer" in content:
            # Written answer grading fallback
            student_ans = ""
            for m in messages:
                c = m.get("content", "")
                if "Student Answer:" in c:
                    student_ans = c.split("Student Answer:")[1].strip()
            
            clean_ans = student_ans.strip()
            if not clean_ans or len(clean_ans) < 15:
                return json.dumps({
                    "score": 0.0,
                    "feedback": "Answer was blank or insufficient to evaluate."
                })
            elif len(clean_ans) < 50:
                return json.dumps({
                    "score": 30.0,
                    "feedback": "Partial explanation provided with limited technical depth (Rule-based fallback)."
                })
            else:
                return json.dumps({
                    "score": 55.0,
                    "feedback": "Detailed response recorded. Assigned baseline score pending instructor review."
                })

        elif "viva" in content and "follow-up questions" in content:
            return json.dumps([
                "Why did you choose this specific data structure or approach for your implementation?",
                "What is the worst-case time and space complexity of your solution, and how does it scale?",
                "How does your implementation handle edge cases such as empty, negative, or duplicate inputs?"
            ])

        elif "variant" in content:
            return json.dumps({
                "variant_text": "Write a Python function that solves the problem with the given constraints and edge cases.",
                "variant_test_cases": [
                    {"input": "10\n20", "expected": "30"},
                    {"input": "5\n-2", "expected": "3"}
                ]
            })

        return "Acknowledged response."


llm_client = LLMClient()


async def grade_written_answer(question_text: str, rubric: str, student_answer: str) -> Dict[str, Any]:
    messages = [
        {
            "role": "system",
            "content": (
                "You are an academic computer science professor. Grade the student's answer strictly based on the question and rubric.\n"
                "Return ONLY valid JSON with keys: score (float between 0.0 and 100.0), feedback (string, 1-2 constructive sentences).\n"
                "If the answer is incorrect, off-topic, or trivial, give a low score (0 to 30).\n"
                "Only give a high score (>80) if the answer is accurate and complete."
            )
        },
        {
            "role": "user",
            "content": f"Question: {question_text}\n\nRubric: {rubric}\n\nStudent Answer: {student_answer}"
        }
    ]
    response = await llm_client.chat(messages)
    match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return {"score": 40.0, "feedback": "Answer evaluated with baseline score."}


async def generate_question_variant(
    base_question: str,
    base_test_cases: List[Dict],
    student_name: str,
) -> Dict[str, Any]:
    messages = [
        {
            "role": "system",
            "content": (
                "You are a computer science exam question writer. "
                "Generate a variant of the given coding question with DIFFERENT example values/scenarios "
                "but the SAME core algorithmic logic and difficulty level. "
                "Return ONLY valid JSON with keys: "
                "variant_text (string, the new question), "
                "variant_test_cases (list of {input: str, expected: str} dicts)."
            )
        },
        {
            "role": "user",
            "content": (
                f"Original question: {base_question}\n\n"
                f"Original test cases: {base_test_cases}\n\n"
                f"Generate a variant for student: {student_name}."
            )
        }
    ]
    response = await llm_client.chat(messages, temperature=0.7)
    match = re.search(r'\{.*\}', response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return {"variant_text": base_question, "variant_test_cases": base_test_cases}


async def generate_viva_questions(code: str, question_text: str, count: int = 3) -> List[str]:
    messages = [
        {
            "role": "system",
            "content": (
                f"You are an oral exam examiner for computer science students. "
                f"Generate exactly {count} thoughtful oral follow-up questions probing the student's genuine conceptual understanding of the code they submitted. "
                "Questions MUST probe WHY they chose their specific logic, trade-offs, time/space complexity, and failure modes under edge cases. "
                "Return ONLY a JSON array of question strings."
            )
        },
        {
            "role": "user",
            "content": f"Exam Question: {question_text}\n\nStudent's Code:\n```python\n{code}\n```"
        }
    ]
    response = await llm_client.chat(messages)
    match = re.search(r'\[.*\]', response, re.DOTALL)
    if match:
        try:
            questions = json.loads(match.group())
            return questions[:count]
        except Exception:
            pass
    return [
        "Why did you choose this specific implementation approach instead of alternative algorithms or data structures?",
        "What is the worst-case time and space complexity of your solution, and how would it behave with large inputs?",
        "How would your code behave on edge cases such as empty input, negative values, or duplicate elements?"
    ][:count]


async def evaluate_viva_answer(
    viva_question: str,
    student_code: str,
    student_answer: str,
) -> Dict[str, Any]:
    messages = [
        {
            "role": "system",
            "content": (
                "You are a strict computer science professor conducting an oral viva examination. "
                "Your objective is to verify whether the student genuinely wrote and understands their code.\n\n"
                "GRADING RULES:\n"
                "1. Rigorously compare the student's answer against the specific viva question AND their submitted code.\n"
                "2. If the answer is incorrect, off-topic, evasive, contradicts the code, or contains nonsense, assign confidence 'low' and score between 0 and 20.\n"
                "3. If the answer is vague, generic, or only partially correct with missing critical technical explanations, assign confidence 'medium' and score between 30 and 65.\n"
                "4. ONLY if the answer is technically accurate, directly explains the logic/trade-offs, and aligns with their code, assign confidence 'high' and score between 75 and 100.\n"
                "5. If the answer is empty or says 'I don't know', assign confidence 'low' and score 0.\n\n"
                "Return ONLY valid JSON in this exact structure:\n"
                "{\n"
                '  "confidence": "low" | "medium" | "high",\n'
                '  "score": <number between 0.0 and 100.0>,\n'
                '  "reasoning": "<1-2 sentences explaining what was correct or missing in the response>"\n'
                "}"
            )
        },
        {
            "role": "user",
            "content": (
                f"VIVA QUESTION: {viva_question}\n\n"
                f"STUDENT'S SUBMITTED CODE:\n```python\n{student_code}\n```\n\n"
                f"STUDENT'S ANSWER: {student_answer}"
            )
        }
    ]
    response = await llm_client.chat(messages, temperature=0.2)
    match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group())
            # Normalize confidence
            conf = str(parsed.get("confidence", "low")).lower()
            if conf not in ("low", "medium", "high"):
                conf = "medium" if float(parsed.get("score", 0)) >= 50 else "low"
            score = float(parsed.get("score", 100.0 if conf == "high" else (50.0 if conf == "medium" else 15.0)))
            return {
                "confidence": conf,
                "score": score,
                "reasoning": str(parsed.get("reasoning", "")),
            }
        except Exception:
            pass
            
    return {
        "confidence": "low",
        "score": 20.0,
        "reasoning": "Could not verify understanding from the response provided."
    }
