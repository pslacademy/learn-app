// src/lib/courses.ts
//
// Everything the app knows about courses.
//
// Nothing here is hardcoded. EI Academy kept a course list, a tier map and a
// prerequisite chain in the source, which meant adding a course was a code
// change and the three lists could disagree with the database. PSLA reads the
// database, and the database is also what enforces access, so the listing and
// the gate can never say different things.
//
// What this file returns is what the member is allowed to receive. A locked
// course comes back with its title and image and no modules at all, because
// RLS gives it nothing further. That is not a bug to work around: it is the
// gate working, and the interface is built to expect it.

import { supabase } from "./supabase";

export interface Resource {
  title: string;
  type?: string;
  size?: string;
  url: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  module_id: string | null;
  title: string;
  description: string | null;
  duration: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  resources: Resource[];
  sort_order: number;
  is_published: boolean;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  code: string | null;
  image_url: string | null;
  lesson_count: number;
  sort_order: number;
  is_active: boolean;
  /** The communities that reach this course. Empty means nobody. */
  community_ids: string[];
  /** Whether this member may open it. Decided by the database, not here. */
  unlocked: boolean;
  modules: Module[];
}

/**
 * Every course the member may see, in display order.
 *
 * Locked courses are included, with no modules. Whether a course is unlocked
 * is determined by asking the database which courses returned lesson rows,
 * rather than by re-deriving the rule in JavaScript. Two implementations of
 * "may this member take this" would eventually disagree, and the disagreement
 * would show as a course that looks open and then plays nothing.
 */
export const listCourses = async (): Promise<Course[]> => {
  const [{ data: courses, error }, { data: links }, { data: modules }, { data: lessons }] =
    await Promise.all([
      supabase
        .from("courses")
        .select("id, slug, title, description, code, image_url, lesson_count, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("course_communities").select("course_id, community_id"),
      supabase.from("course_modules").select("id, course_id, title, sort_order").order("sort_order"),
      supabase
        .from("course_lessons")
        .select(
          "id, course_id, module_id, title, description, duration, video_url, thumbnail_url, resources, sort_order, is_published",
        )
        .order("sort_order"),
    ]);

  if (error) {
    console.error("Could not read courses:", error.message);
    return [];
  }

  const modulesByCourse = new Map<string, Module[]>();
  for (const m of modules ?? []) {
    const list = modulesByCourse.get(m.course_id) ?? [];
    list.push({ ...(m as Module), lessons: [] });
    modulesByCourse.set(m.course_id, list);
  }

  const lessonsByCourse = new Map<string, Lesson[]>();
  for (const raw of lessons ?? []) {
    const lesson: Lesson = {
      ...(raw as Lesson),
      resources: Array.isArray(raw.resources) ? (raw.resources as Resource[]) : [],
    };
    const list = lessonsByCourse.get(lesson.course_id) ?? [];
    list.push(lesson);
    lessonsByCourse.set(lesson.course_id, list);
  }

  const communitiesByCourse = new Map<string, string[]>();
  for (const l of links ?? []) {
    const list = communitiesByCourse.get(l.course_id) ?? [];
    list.push(l.community_id);
    communitiesByCourse.set(l.course_id, list);
  }

  return (courses ?? []).map((c) => {
    const courseModules = modulesByCourse.get(c.id) ?? [];
    const courseLessons = lessonsByCourse.get(c.id) ?? [];

    for (const lesson of courseLessons) {
      const parent = courseModules.find((m) => m.id === lesson.module_id);
      if (parent) parent.lessons.push(lesson);
    }

    /*
      Unlocked means the database gave us the inside of the course. It did
      not for a course the member has not bought, so there is nothing to
      infer and nothing to re-check.
    */
    return {
      ...(c as Course),
      community_ids: communitiesByCourse.get(c.id) ?? [],
      unlocked: courseLessons.length > 0,
      modules: courseModules,
    };
  });
};

/** One course with its modules and lessons, by slug. */
export const getCourse = async (slug: string): Promise<Course | null> => {
  const all = await listCourses();
  return all.find((c) => c.slug === slug) ?? null;
};

/** Every lesson in a course, flattened, in the order a member works through them. */
export const orderedLessons = (course: Course): Lesson[] =>
  course.modules.flatMap((m) => m.lessons);

/**
 * Where a locked card should send someone.
 *
 * Whichever of the course's communities has somewhere to buy it. A community
 * with no purchase_url yields nothing, and the card then says the course is
 * not available to them rather than offering a link that goes nowhere.
 */
export const purchaseUrlForCourse = async (
  course: Course,
): Promise<string | null> => {
  if (course.community_ids.length === 0) return null;

  const { data } = await supabase
    .from("communities")
    .select("id, purchase_url, sort_order")
    .in("id", course.community_ids)
    .not("purchase_url", "is", null)
    .order("sort_order");

  return data?.[0]?.purchase_url ?? null;
};
