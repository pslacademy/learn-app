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
  /** Saved as they type. Does not open the next module. */
  is_draft: boolean;
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

/**
 * Save what they have written so far.
 *
 * The same row as the eventual submission, marked unfinished, so a draft
 * becomes the submission rather than sitting beside it. Saved to the database
 * rather than the browser: somebody who writes half an answer on a laptop
 * should find it on their phone.
 *
 * Failure is logged and not shown. An autosave that interrupts with an error
 * toast while somebody is mid-sentence is worse than one that quietly retries
 * on the next keystroke.
 */
export const saveDraft = async (
  courseId: string,
  lesson: Lesson,
  answers: Record<string, string>,
): Promise<void> => {
  const { data: session } = await supabase.auth.getSession();
  const me = session?.session?.user?.id;
  if (!me) return;

  const { error } = await supabase.from("assessment_submissions").upsert(
    {
      member_id: me,
      course_id: courseId,
      lesson_id: lesson.id,
      answers,
      questions: questionsOf(lesson),
      is_draft: true,
    },
    { onConflict: "member_id,lesson_id" },
  );

  if (error) console.warn("Draft not saved:", error.message);
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
      is_draft: false,
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
    /* A draft is not a submission: typing one character must not open the
       next module. */
    const done = assessment ? submissions.get(assessment.id) : undefined;
    if (assessment && (!done || done.is_draft)) previousBlocked = true;
  }

  return open;
};

/** Every submission, for the team. Most recent first. */
export const allSubmissions = async (): Promise<Submission[]> => {
  /* Drafts are excluded by policy as well, so this filter is belt and
     braces rather than the thing keeping them out. */
  const { data, error } = await supabase
    .from("assessment_submissions")
    .select("*")
    .eq("is_draft", false)
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

/**
 * Download a submission as a PDF.
 *
 * A record of what somebody wrote about their own practice, which is worth
 * keeping outside a login. Portrait, because these are paragraphs rather than
 * a certificate.
 */
export const downloadSubmission = async (
  submission: Submission,
  courseTitle: string,
  lessonTitle: string,
  memberName: string,
) => {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const NAVY: [number, number, number] = [44, 62, 80];
  const ORANGE: [number, number, number] = [245, 130, 32];
  const GREY: [number, number, number] = [110, 120, 130];

  const left = 20;
  const width = W - left * 2;
  let y = 24;

  /* Starts a new page when the next block would run off this one. Checked
     before each block rather than after, so a heading never sits alone at the
     foot of a page with its answer overleaf. */
  const room = (needed: number) => {
    if (y + needed < H - 20) return;
    doc.addPage();
    y = 24;
  };

  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, W, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text(lessonTitle, left, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GREY);
  doc.text(courseTitle, left, y);
  y += 5;
  doc.text(
    `${memberName} • submitted ${new Date(submission.submitted_at).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`,
    left,
    y,
  );
  y += 8;

  doc.setDrawColor(220, 224, 228);
  doc.setLineWidth(0.3);
  doc.line(left, y, W - left, y);
  y += 10;

  (submission.questions ?? []).forEach((q, i) => {
    const prompt = doc.splitTextToSize(`${i + 1}. ${q.prompt}`, width) as string[];
    const answer = doc.splitTextToSize(
      submission.answers?.[q.id] || "No answer given.",
      width - 4,
    ) as string[];

    room(prompt.length * 5 + answer.length * 5 + 14);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(prompt, left, y);
    y += prompt.length * 5 + 3;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 70, 80);
    doc.text(answer, left + 4, y);
    y += answer.length * 5 + 9;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text("Professional Services Leadership Academy", left, H - 12);

  const safe = lessonTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`psla-assessment-${safe}.pdf`);
};
