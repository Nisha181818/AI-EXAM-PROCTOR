export type UserRole = 'student' | 'teacher';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  enrollment_photo_url?: string;
  created_at?: string;
}

export interface Course {
  id: number;
  name: string;
  teacher_id: number;
  created_at?: string;
}

export interface Exam {
  id: number;
  course_id: number;
  title: string;
  duration_minutes: number;
  start_time?: string;
  end_time?: string;
  created_at?: string;
}

export type QuestionType = 'coding' | 'written';

export interface TestCase {
  input: string;
  expected: string;
}

export interface Question {
  id: number;
  exam_id: number;
  type: QuestionType;
  base_text: string;
  rubric?: string;
  base_test_cases?: TestCase[];
  order_index: number;
}

export interface QuestionVariant {
  id: number;
  question_id: number;
  student_id: number;
  variant_text: string;
  variant_test_cases?: TestCase[];
}

export type AttemptStatus = 'not_started' | 'in_progress' | 'locked_pending_review' | 'submitted';

export interface ExamAttempt {
  id: number;
  exam_id: number;
  student_id: number;
  status: AttemptStatus;
  integrity_strike_count: number;
  integrity_score?: number;
  started_at?: string;
  submitted_at?: string;
  identity_verified: string;
}

export interface ExamEvent {
  id: number;
  attempt_id: number;
  event_type: string;
  severity: 'soft' | 'hard';
  description?: string;
  evidence_url?: string;
  timestamp?: string;
}

export interface Submission {
  id: number;
  attempt_id: number;
  question_id: number;
  answer_text?: string;
  test_results?: any[];
  score?: number;
  max_score: number;
  ai_feedback?: string;
  manually_overridden?: string;
  override_score?: number;
  override_feedback?: string;
}

export interface VivaQuestion {
  id: number;
  attempt_id: number;
  submission_id: number;
  question_text: string;
  student_answer?: string;
  understanding_confidence?: 'low' | 'medium' | 'high';
  ai_reasoning?: string;
  answered_at?: string;
}
