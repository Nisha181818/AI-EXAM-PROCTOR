from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User, UserRole
from app.models.course import Course, Enrollment
from app.schemas.course import CourseCreate, CourseOut, EnrollmentCreate, EnrollmentOut
from app.services.auth_utils import get_current_user, require_teacher

router = APIRouter()


@router.post("/", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(
    course_in: CourseCreate,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = Course(name=course_in.name, teacher_id=current_user.id)
    db.add(course)
    db.commit()
    db.refresh(course)

    # Auto-enroll all existing students in the new course
    try:
        students = db.query(User).filter(User.role == UserRole.student).all()
        for s in students:
            db.add(Enrollment(student_id=s.id, course_id=course.id))
        db.commit()
    except Exception as e:
        print(f"Auto-enrollment on course create: {e}")

    return course


@router.get("/", response_model=List[CourseOut])
def list_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role.value == "teacher":
        return db.query(Course).filter(Course.teacher_id == current_user.id).all()
    else:
        # Students see all courses so course labels are available for all active exams
        return db.query(Course).all()


@router.get("/{course_id}", response_model=CourseOut)
def get_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.post("/enroll", response_model=EnrollmentOut, status_code=status.HTTP_201_CREATED)
def enroll_student(
    enrollment_in: EnrollmentCreate,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(
        Course.id == enrollment_in.course_id,
        Course.teacher_id == current_user.id
    ).first()
    if not course:
        raise HTTPException(status_code=403, detail="Not authorized for this course")

    student = db.query(User).filter(User.id == enrollment_in.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    existing = db.query(Enrollment).filter(
        Enrollment.student_id == enrollment_in.student_id,
        Enrollment.course_id == enrollment_in.course_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student already enrolled")

    enrollment = Enrollment(student_id=enrollment_in.student_id, course_id=enrollment_in.course_id)
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


@router.get("/{course_id}/students")
def list_enrolled_students(
    course_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    course = db.query(Course).filter(Course.id == course_id, Course.teacher_id == current_user.id).first()
    if not course:
        raise HTTPException(status_code=403, detail="Not authorized")
    enrollments = db.query(Enrollment).filter(Enrollment.course_id == course_id).all()
    student_ids = [e.student_id for e in enrollments]
    students = db.query(User).filter(User.id.in_(student_ids)).all()
    return [{"id": s.id, "name": s.name, "email": s.email, "enrollment_photo_url": s.enrollment_photo_url} for s in students]
