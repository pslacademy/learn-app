// src/lib/progress.ts
//
// Which lessons a member has finished.
//
// One row per completed lesson, in the database. Not a percentage on the
// member: a percentage cannot say which lesson was done, cannot be
// recalculated when a course gains a lesson, and cannot answer whether
// somebody actually reached the end. It is also not in the browser, so
// finishing a course on a laptop is finished on a phone.
//
// The database refuses to record progress on a course the member cannot take,
// so nothing here needs to check that first. This file reports what happened;
// it does not decide what is allowed.

import { supabase } from "./supabase";
import type { Course } from "./courses";

let completed: Set<string> | null = null;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();

/** Re-render when progress lands or changes. */
export const onProgressChange = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const announce = () => listeners.forEach((fn) => fn());

/**
 * Load this member's completed lessons.
 *
 * Keyed to the signed-in member, so a second person signing in on the same
 * machine does not inherit the first one's progress from a stale cache.
 */
export const loadProgress = async (force = false): Promise<void> => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id ?? null;

  if (!userId) {
    completed = new Set();
    loadedFor = null;
    announce();
    return;
  }

  if (!force && loadedFor === userId && completed) return;

  const { data, error } = await supabase
    .from("course_progress")
    .select("lesson_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Could not read your progress:", error.message);
    return;
  }

  completed = new Set((data ?? []).map((r) => r.lesson_id as string));
  loadedFor = userId;
  announce();
};

export const isLessonComplete = (lessonId: string): boolean =>
  completed?.has(lessonId) ?? false;

/**
 * Mark a lesson finished.
 *
 * Written before the interface changes, and rolled back if the database
 * refuses, so a tick can never appear for something that was not recorded.
 */
export const markLessonComplete = async (
  courseId: string,
  lessonId: string,
): Promise<boolean> => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) return false;

  if (completed?.has(lessonId)) return true;

  const { error } = await supabase
    .from("course_progress")
    .upsert(
      { user_id: userId, course_id: courseId, lesson_id: lessonId },
      { onConflict: "user_id,course_id,lesson_id", ignoreDuplicates: true },
    );

  if (error) {
    console.error("Could not record progress:", error.message);
    return false;
  }

  completed?.add(lessonId);
  announce();
  return true;
};

/** Undo, for a member who ticked the wrong thing. */
export const markLessonIncomplete = async (lessonId: string): Promise<void> => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) return;

  const { error } = await supabase
    .from("course_progress")
    .delete()
    .eq("user_id", userId)
    .eq("lesson_id", lessonId);

  if (error) {
    console.error("Could not undo that:", error.message);
    return;
  }

  completed?.delete(lessonId);
  announce();
};

/**
 * How far through a course this member is, as a percentage.
 *
 * Counts only lessons the member can actually see. A locked course therefore
 * reports 0 rather than dividing by nothing, and a course whose unpublished
 * lessons are hidden does not sit permanently at 90%.
 */
export const courseProgress = (course: Course): number => {
  const lessons = course.modules.flatMap((m) => m.lessons);
  if (lessons.length === 0) return 0;

  const done = lessons.filter((l) => isLessonComplete(l.id)).length;
  return Math.round((done / lessons.length) * 100);
};

export const courseCompletedCount = (course: Course): number =>
  course.modules
    .flatMap((m) => m.lessons)
    .filter((l) => isLessonComplete(l.id)).length;

/** The first unfinished lesson, or the first lesson if they have finished. */
export const nextLesson = (course: Course) => {
  const lessons = course.modules.flatMap((m) => m.lessons);
  return lessons.find((l) => !isLessonComplete(l.id)) ?? lessons[0] ?? null;
};

export const clearProgressCache = () => {
  completed = null;
  loadedFor = null;
};
