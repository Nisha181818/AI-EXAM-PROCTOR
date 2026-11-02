import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine, Base
from app.models.user import User, UserRole
from app.models.course import Course, Enrollment
from app.models.exam import Exam, Question, QuestionType
from app.services.auth_utils import hash_password
from datetime import datetime, timezone, timedelta


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == "teacher@demo.com").first():
            print("Database already seeded.")
            return

        teacher = User(
            name="Prof. Demo",
            email="teacher@demo.com",
            password_hash=hash_password("teacher123"),
            role=UserRole.teacher,
        )
        db.add(teacher)
        db.flush()

        student = User(
            name="Alice Student",
            email="student@demo.com",
            password_hash=hash_password("student123"),
            role=UserRole.student,
        )
        db.add(student)
        db.flush()

        course = Course(name="Introduction to Algorithms", teacher_id=teacher.id)
        db.add(course)
        db.flush()

        enrollment = Enrollment(student_id=student.id, course_id=course.id)
        db.add(enrollment)
        db.flush()

        now = datetime.now(timezone.utc)
        exam = Exam(
            course_id=course.id,
            title="Midterm Exam - Sorting & Search Algorithms",
            duration_minutes=60,
            start_time=now,
            end_time=now + timedelta(hours=4),
        )
        db.add(exam)
        db.flush()

        coding_q = Question(
            exam_id=exam.id,
            type=QuestionType.coding,
            base_text=(
                "Write a Python function `two_sum(nums, target)` that takes a list of integers `nums` "
                "and an integer `target`, and returns the indices of two numbers that add up to target. "
                "Output the indices in brackets like [0, 1].\n\n"
                "Input format:\nFirst line: comma-separated integers (e.g. 2,7,11,15)\nSecond line: target integer (e.g. 9)"
            ),
            base_test_cases=[
                {"input": "2,7,11,15\n9", "expected": "[0, 1]"},
                {"input": "3,2,4\n6", "expected": "[1, 2]"},
                {"input": "3,3\n6", "expected": "[0, 1]"},
            ],
            reference_solution=(
                "import sys\n"
                "lines = sys.stdin.read().strip().split('\n')\n"
                "if len(lines) >= 2:\n"
                "    nums = [int(x.strip()) for x in lines[0].split(',') if x.strip()]\n"
                "    target = int(lines[1].strip())\n"
                "    seen = {}\n"
                "    for i, n in enumerate(nums):\n"
                "        diff = target - n\n"
                "        if diff in seen:\n"
                "            print(f'[{seen[diff]}, {i}]')\n"
                "            break\n"
                "        seen[n] = i\n"
            ),
            order_index=0,
        )
        db.add(coding_q)

        written_q = Question(
            exam_id=exam.id,
            type=QuestionType.written,
            base_text="Explain the difference between BFS (Breadth-First Search) and DFS (Depth-First Search) graph traversal algorithms. When would you prefer BFS over DFS? Give a real-world use case for each.",
            rubric=(
                "Rubric (100 pts total): "
                "(1) Description of BFS using a queue (20 pts), "
                "(2) Description of DFS using a stack or recursion (20 pts), "
                "(3) Comparison of time and space complexity (20 pts), "
                "(4) Real-world use case for BFS (e.g., shortest path unweighted, social network distance) (20 pts), "
                "(5) Real-world use case for DFS (e.g., topological sort, maze solving, cycle detection) (20 pts)."
            ),
            order_index=1,
        )
        db.add(written_q)
        db.commit()

        print("=== Database Seed Complete ===")
        print("Teacher: teacher@demo.com / teacher123")
        print("Student: student@demo.com / student123")
        print(f"Course: {course.name} (ID: {course.id})")
        print(f"Exam: {exam.title} (ID: {exam.id})")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
