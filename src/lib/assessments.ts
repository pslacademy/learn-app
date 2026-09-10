// src/lib/assessments.ts
//
// Assessments.
//
// Questions live on a lesson. A lesson with questions is that module's
// assessment, and submitting it opens the next module. A course with no
// questions anywhere behaves as it always has, so this is opt-in per course.
//
// Nothing is marked. These are reflective questions read by the team, and a
// score would invite people to write what scores well rather than what is
// true.

import { supabase } from "./supabase";
import type { Course, Lesson } from "./courses";

export type QuestionType = "written" | "choice";

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  /** Only for a multiple choice question. */
  options?: string[];
}

export interface Submission {
  id: string;
  member_id: string;
  course_id: string;
  lesson_id: string;
  answers: Record<string, string>;
  /** Copied at submission, so an answer still reads correctly after the
      questions have been rewritten. */
  questions: Question[];
  submitted_at: string;
}

export const questionsOf = (lesson: Lesson): Question[] =>
  Array.isArray((lesson as unknown as { questions?: unknown }).questions)
    ? ((lesson as unknown as { questions: Question[] }).questions ?? [])
    : [];

/** A lesson with questions is its module's assessment. */
export const isAssessment = (lesson: Lesson): boolean =>
  questionsOf(lesson).length > 0;

/**
 * The member's own submissions, keyed by lesson.
 *
 * Read once per course rather than per lesson: the player needs to know which
 * modules are open before it draws anything, and a request per lesson would
 * show the sidebar unlocking itself line by line.
 */
export const mySubmissions = async (): Promise<Map<string, Submission>> => {
  const { data, error } = await supabase.from("assessment_submissions").select("*");
  if (error) {
    console.error("Could not read your submissions:", error.message);
    return new Map();
  }
  return new Map(
    ((data ?? []) as Submission[]).map((s) => [s.lesson_id, s]),
  );
};

export const submitAssessment = async (
  courseId: string,
  lesson: Lesson,
  answers: Record<string, string>,
): Promise<{ error: string | null }> => {
  const { data: session } = await supabase.auth.getSession();
  const me = session?.session?.user?.id;
  if (!me) return { error: "You are not signed in." };

  const { error } = await supabase.from("assessment_submissions").upsert(
    {
      member_id: me,
      course_id: courseId,
      lesson_id: lesson.id,
      answers,
      /* The questions as they stood. Without this, rewriting a question
         later turns every past answer into a paragraph with no context. */
      questions: questionsOf(lesson),
    },
    { onConflict: "member_id,lesson_id" },
  );

  return { error: error?.message ?? null };
};

/**
 * Which modules are open to this member.
 *
 * Worked out here from the course and the member's submissions, rather than
 * asked of the database module by module, because the player needs all of
 * them at once. The same rule the database uses: the first module is always
 * open, and any other opens when the previous module's assessment, if it has
 * one, has been submitted.
 *
 * Sequencing, not entitlement. The member has paid for the whole course, and
 * the lesson rows are not hidden from them.
 */
export const openModules = (
  course: Course,
  submissions: Map<string, Submission>,
  isTeam = false,
): Set<string> => {
  const open = new Set<string>();
  let previousBlocked = false;

  for (const module of course.modules) {
    if (isTeam || !previousBlocked) open.add(module.id);

    const assessment = module.lessons.find(
      (l) => l.is_published && isAssessment(l),
    );

    /* Once one module blocks, everything after it is closed too: opening
       module four while three is shut would make the sequence meaningless. */
    if (assessment && !submissions.has(assessment.id)) previousBlocked = true;
  }

  return open;
};

/** Every submission, for the team. Most recent first. */
export const allSubmissions = async (): Promise<Submission[]> => {
  const { data, error } = await supabase
    .from("assessment_submissions")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Could not read submissions:", error.message);
    return [];
  }
  return (data ?? []) as Submission[];
};

/** A short id for a new question. Unique enough within one lesson. */
export const newQuestionId = () =>
  `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
