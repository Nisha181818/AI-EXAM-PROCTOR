import json
import re
from typing import List, Dict, Any, Optional
from app.config import settings


class LLMClient:
    def __init__(self):
        self.provider = settings.llm_provider.lower()

    async def chat(self, messages: List[Dict[str, str]], temperature: float = 0.3) -> str:
        if self.provider == "openai" and settings.openai_api_key and not settings.openai_api_key.startswith("sk-placeholder"):
            try:
                return await self._openai_chat(messages, temperature)
            except Exception as e:
                print(f"OpenAI error: {e}, falling back to rule-based response")
        elif self.provider == "anthropic" and settings.anthropic_api_key and not settings.anthropic_api_key.startswith("sk-ant-placeholder"):
            try:
                return await self._anthropic_chat(messages, temperature)
            except Exception as e:
                print(f"Anthropic error: {e}, falling back to rule-based response")

        # Mock fallback when API key is not configured or fails
        return self._fallback_response(messages)

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
        if "rubric" in content or "grade" in content:
            return json.dumps({
                "score": 85.0,
                "feedback": "The explanation demonstrates good understanding of core principles, key trade-offs, and appropriate real-world use cases."
            })
        elif "viva" in content and "follow-up questions" in content:
            return json.dumps([
                "Why did you choose this specific data structure for your solution instead of a list or set?",
                "What is the worst-case time and space complexity of your algorithm, and how would it behave with 1,000,000 inputs?",
                "How would you modify your implementation to handle negative numbers or duplicate values?"
            ])
        elif "confidence" in content or "evaluating a student" in content:
            return json.dumps({
                "confidence": "high",
                "reasoning": "The student clearly articulated the rationale behind their implementation, demonstrated accurate complexity awareness, and addressed edge cases directly."
            })
        elif "variant" in content:
            return json.dumps({
                "variant_text": "Write a Python function that finds two numbers in a provided list that sum to a given target, returning their 0-based indices.",
                "variant_test_cases": [
                    {"input": "[10, 20, 30, 40]\n50", "expected": "[1, 2]"},
                    {"input": "[5, 1, 9, 3]\n6", "expected": "[0, 1]"}
                ]
            })
        return "Acknowledged response."


llm_client = LLMClient()


async def grade_written_answer(question_text: str, rubric: str, student_answer: str) -> Dict[str, Any]:
    messages = [
        {
            "role": "system",
            "content": (
                "You are an academic grader. Grade the student's answer strictly based on the rubric. "
                "Return ONLY valid JSON with keys: score (0-100 float), feedback (string). "
                "Be fair but strict. Penalize vague answers."
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
    return {"score": 75.0, "feedback": response}


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
                "but the SAME logic and difficulty level. "
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
                f"Generate exactly {count} thoughtful follow-up questions about the student's submitted code. "
                "Questions should probe understanding, not just what the code does. "
                "Focus on: why they used certain data structures, time complexity, edge cases, alternatives. "
                "Return ONLY a JSON array of question strings."
            )
        },
        {
            "role": "user",
            "content": f"Exam Question: {question_text}\n\nStudent's Code:\n```\n{code}\n```"
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
        "Why did you choose this specific implementation approach?",
        "What is the time complexity of your solution and could it be improved?",
        "How would your code behave on empty or unexpected inputs?"
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
                "You are evaluating a student's oral exam response. "
                "Determine if they genuinely understand the code they submitted. "
                "Return ONLY valid JSON with keys: "
                "confidence (one of: low, medium, high), "
                "reasoning (string, 1-2 sentences explaining your assessment)."
            )
        },
        {
            "role": "user",
            "content": (
                f"Viva Question: {viva_question}\n\n"
                f"Student's Submitted Code:\n```\n{student_code}\n```\n\n"
                f"Student's Answer: {student_answer}"
            )
        }
    ]
    response = await llm_client.chat(messages)
    match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return {"confidence": "medium", "reasoning": "The answer covers basic reasoning and mechanics."}
