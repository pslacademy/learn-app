import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  ChevronRight,
  FileText,
  Calendar,
  Users,
  MessageSquare,
  GraduationCap,
  LayoutList,
  Loader2,
  Plus,
  Save,
  Trash2,
  ArrowUp,
  ArrowDown,
  Video,
  Image as ImageIcon,
  ShieldAlert,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { getProfile, type Profile } from "@/lib/account";
import { listCourses, type Course, type Lesson, type Resource } from "@/lib/courses";
import { allCommunities, type Community } from "@/lib/communities";
import { cn } from "@/lib/utils";

/**
 * Academy administration.
 *
 * Laid out like EI Academy: a tab per area, a navigation panel on the left to
 * pick a course, module and lesson, and an editing panel on the right.
 *
 * Edits are held locally and written by Save all changes, rather than saved
 * on every keystroke. That is what makes reordering and renaming feel like
 * editing a document instead of filing a form, and it means a half-typed
 * title never reaches a member's screen.
 *
 * The tabs for areas that do not exist yet are present but disabled. A tab
 * that navigates nowhere is a dead control; a tab that says "arrives later"
 * is a map.
 */

type Draft = {
  courses: Record<string, Partial<Course>>;
  modules: Record<string, { title?: string; sort_order?: number }>;
  lessons: Record<string, Partial<Lesson>>;
};

const emptyDraft: Draft = { courses: {}, modules: {}, lessons: {} };

const Admin = () => {
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [courseId, setCourseId] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const reload = async (keepSelection = true) => {
    const [list, comms] = await Promise.all([listCourses(), allCommunities()]);
    setCourses(list);
    setCommunities(comms);
    setDraft(emptyDraft);

    if (!keepSelection || !list.some((c) => c.id === courseId)) {
      const first = list[0] ?? null;
      setCourseId(first?.id ?? null);
      setModuleId(first?.modules[0]?.id ?? null);
      setLessonId(first?.modules[0]?.lessons[0]?.id ?? null);
    }
  };

  useEffect(() => {
    Promise.all([getProfile(), reload(false)]).then(([p]) => {
      setProfile(p);
      setLoading(false);
    });
  }, []);

  const course = useMemo(
    () => courses.find((c) => c.id === courseId) ?? null,
    [courses, courseId],
  );
  const module = useMemo(
    () => course?.modules.find((m) => m.id === moduleId) ?? null,
    [course, moduleId],
  );
  const lesson = useMemo(
    () => module?.lessons.find((l) => l.id === lessonId) ?? null,
    [module, lessonId],
  );

  /** The value to show: the unsaved edit if there is one, else what is stored. */
  const courseValue = <K extends keyof Course>(key: K): Course[K] | undefined =>
    course ? ((draft.courses[course.id]?.[key] ?? course[key]) as Course[K]) : undefined;

  const lessonValue = <K extends keyof Lesson>(key: K): Lesson[K] | undefined =>
    lesson ? ((draft.lessons[lesson.id]?.[key] ?? lesson[key]) as Lesson[K]) : undefined;

  const moduleTitle = module
    ? (draft.modules[module.id]?.title ?? module.title)
    : "";

  const dirty =
    Object.keys(draft.courses).length +
      Object.keys(draft.modules).length +
      Object.keys(draft.lessons).length >
    0;

  const editCourse = (patch: Partial<Course>) =>
    course &&
    setDraft((d) => ({
      ...d,
      courses: { ...d.courses, [course.id]: { ...d.courses[course.id], ...patch } },
    }));

  const editModule = (patch: { title?: string }) =>
    module &&
    setDraft((d) => ({
      ...d,
      modules: { ...d.modules, [module.id]: { ...d.modules[module.id], ...patch } },
    }));

  const editLesson = (patch: Partial<Lesson>) =>
    lesson &&
    setDraft((d) => ({
      ...d,
      lessons: { ...d.lessons, [lesson.id]: { ...d.lessons[lesson.id], ...patch } },
    }));

  if (loading) {
    return (
      <DashboardLayout>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </DashboardLayout>
    );
  }

  if (!profile?.is_admin && !profile?.is_editor) {
    return <Navigate to="/dashboard" replace />;
  }

  const isAdmin = Boolean(profile.is_admin);

  /* ---- Writes ----------------------------------------------------- */

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const [id, patch] of Object.entries(draft.courses)) {
        const { error } = await supabase.from("courses").update(patch).eq("id", id);
        if (error) throw new Error(error.message);
      }
      for (const [id, patch] of Object.entries(draft.modules)) {
        const { error } = await supabase.from("course_modules").update(patch).eq("id", id);
        if (error) throw new Error(error.message);
      }
      for (const [id, patch] of Object.entries(draft.lessons)) {
        const { error } = await supabase.from("course_lessons").update(patch).eq("id", id);
        if (error) throw new Error(error.message);
      }
      await reload();
      toast({ title: "Saved", description: "Your changes are live." });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not save",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  /*
    Structural changes write immediately rather than joining the draft.
    Adding a module and then reordering it means the second action needs the
    first to exist, and holding both would mean inventing temporary ids and
    reconciling them on save. Renames are drafted; creations and deletions
    are not.
  */
  const structural = async (what: string, fn: () => Promise<{ error?: unknown }>) => {
    setSaving(true);
    try {
      const { error } = await fn();
      if (error) throw new Error((error as { message: string }).message);
      await reload();
      toast({ title: what });
    } catch (e) {
      toast({
        variant: "destructive",
        title: `Could not ${what.toLowerCase()}`,
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const addCourse = () =>
    structural("Course created", async () =>
      supabase.from("courses").insert({
        slug: `new-course-${Date.now()}`,
        title: "Untitled course",
        sort_order: courses.length + 1,
      }),
    );

  const addModule = () =>
    course
      ? structural("Module added", async () =>
          supabase.from("course_modules").insert({
            course_id: course.id,
            title: `Module ${course.modules.length + 1}`,
            sort_order: course.modules.length + 1,
          }),
        )
      : undefined;

  const addLesson = () =>
    course && module
      ? structural("Lesson added", async () =>
          supabase.from("course_lessons").insert({
            course_id: course.id,
            module_id: module.id,
            title: "Untitled lesson",
            sort_order: module.lessons.length + 1,
          }),
        )
      : undefined;

  /** Swap two rows' sort_order. Cheaper and clearer than renumbering. */
  const move = async (
    table: "course_modules" | "course_lessons",
    rows: Array<{ id: string; sort_order: number }>,
    id: string,
    direction: -1 | 1,
  ) => {
    const index = rows.findIndex((r) => r.id === id);
    const other = rows[index + direction];
    if (!other) return;

    await structural("Order changed", async () => {
      const a = await supabase
        .from(table)
        .update({ sort_order: other.sort_order })
        .eq("id", id);
      if (a.error) return a;
      return supabase
        .from(table)
        .update({ sort_order: rows[index].sort_order })
        .eq("id", other.id);
    });
  };

  const toggleCommunity = (communityId: string, on: boolean) =>
    course
      ? structural(on ? "Community attached" : "Community removed", async () =>
          on
            ? supabase
                .from("course_communities")
                .insert({ course_id: course.id, community_id: communityId })
            : supabase
                .from("course_communities")
                .delete()
                .eq("course_id", course.id)
                .eq("community_id", communityId),
        )
      : undefined;

  const resources: Resource[] = (lessonValue("resources") as Resource[]) ?? [];

  const setResource = (index: number, patch: Partial<Resource>) => {
    const next = resources.map((r, i) => (i === index ? { ...r, ...patch } : r));
    editLesson({ resources: next });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Academy administration
            </h1>
            <p className="mt-1 text-muted-foreground">
              {isAdmin
                ? "Manage course content and decide which communities reach it."
                : "Manage course content."}
            </p>
          </div>
          <Button onClick={saveAll} disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Save all changes
          </Button>
        </div>

        {!isAdmin && (
          <div className="flex items-start gap-3 rounded-lg border bg-muted/60 p-4 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p>
              You can edit course content. Deciding which communities reach a
              course is an administrator's job, so those controls are not shown.
            </p>
          </div>
        )}

        <Tabs defaultValue="content">
          <TabsList className="flex-wrap">
            <TabsTrigger value="content">
              <LayoutList className="mr-2 h-4 w-4" aria-hidden="true" />
              Course content
            </TabsTrigger>
            {/* Present but disabled. Each becomes live with the phase that
                builds the page behind it. A tab that navigates nowhere is a
                dead control; one that says "later" is a map. */}
            <TabsTrigger value="resources" disabled>
              <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
              Resources
            </TabsTrigger>
            <TabsTrigger value="events" disabled>
              <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
              Events
            </TabsTrigger>
            <TabsTrigger value="directory" disabled>
              <Users className="mr-2 h-4 w-4" aria-hidden="true" />
              Member directory
            </TabsTrigger>
            <TabsTrigger value="community" disabled>
              <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
              Community
            </TabsTrigger>
            <TabsTrigger value="assessments" disabled>
              <GraduationCap className="mr-2 h-4 w-4" aria-hidden="true" />
              Assessments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
              {/* ---- Navigation ---- */}
              <Card className="h-fit">
                <CardContent className="space-y-6 p-6">
                  <div>
                    <h2 className="text-lg font-semibold">Navigation</h2>
                    <p className="text-sm text-muted-foreground">
                      Select a course and lesson to edit
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Select course</Label>
                    <div className="flex gap-2">
                      <Select
                        value={courseId ?? ""}
                        onValueChange={(v) => {
                          const c = courses.find((x) => x.id === v) ?? null;
                          setCourseId(v);
                          setModuleId(c?.modules[0]?.id ?? null);
                          setLessonId(c?.modules[0]?.lessons[0]?.id ?? null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No courses yet" />
                        </SelectTrigger>
                        <SelectContent>
                          {courses.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={addCourse}
                        disabled={saving}
                        aria-label="Add course"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {course && (
                    <>
                      <div className="space-y-2">
                        <Label>Select module</Label>
                        <Select
                          value={moduleId ?? ""}
                          onValueChange={(v) => {
                            const m = course.modules.find((x) => x.id === v) ?? null;
                            setModuleId(v);
                            setLessonId(m?.lessons[0]?.id ?? null);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="No modules yet" />
                          </SelectTrigger>
                          <SelectContent>
                            {course.modules.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addModule}
                            disabled={saving}
                          >
                            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                            Add module
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Move module up"
                            disabled={saving || !module}
                            onClick={() =>
                              module && move("course_modules", course.modules, module.id, -1)
                            }
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Move module down"
                            disabled={saving || !module}
                            onClick={() =>
                              module && move("course_modules", course.modules, module.id, 1)
                            }
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete module"
                            disabled={saving || !module}
                            onClick={() =>
                              module &&
                              structural("Module deleted", async () =>
                                supabase.from("course_modules").delete().eq("id", module.id),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {module && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="module-title">Module title</Label>
                            <Input
                              id="module-title"
                              value={moduleTitle}
                              onChange={(e) => editModule({ title: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Select lesson</Label>
                            <div className="overflow-hidden rounded-md border">
                              {module.lessons.length === 0 && (
                                <p className="px-3 py-3 text-sm text-muted-foreground">
                                  No lessons yet
                                </p>
                              )}
                              {module.lessons.map((l) => (
                                <button
                                  key={l.id}
                                  type="button"
                                  onClick={() => setLessonId(l.id)}
                                  className={cn(
                                    "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted",
                                    lessonId === l.id &&
                                      "bg-primary text-primary-foreground hover:bg-primary",
                                  )}
                                >
                                  {draft.lessons[l.id]?.title ?? l.title}
                                  {lessonId === l.id && (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              ))}
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={addLesson}
                                disabled={saving}
                              >
                                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                                Add lesson
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Move lesson up"
                                disabled={saving || !lesson}
                                onClick={() =>
                                  lesson &&
                                  move("course_lessons", module.lessons, lesson.id, -1)
                                }
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Move lesson down"
                                disabled={saving || !lesson}
                                onClick={() =>
                                  lesson &&
                                  move("course_lessons", module.lessons, lesson.id, 1)
                                }
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete lesson"
                                disabled={saving || !lesson}
                                onClick={() =>
                                  lesson &&
                                  structural("Lesson deleted", async () =>
                                    supabase
                                      .from("course_lessons")
                                      .delete()
                                      .eq("id", lesson.id),
                                  )
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* ---- Editing ---- */}
              <Card>
                <CardContent className="space-y-8 p-6">
                  {!course ? (
                    <p className="py-12 text-center text-muted-foreground">
                      Create a course to begin.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <LayoutList className="h-5 w-5 text-primary" aria-hidden="true" />
                        <h2 className="text-lg font-semibold">
                          Editing: {lesson ? (lessonValue("title") as string) : course.title}
                        </h2>
                      </div>

                      {/* Course settings */}
                      <div className="space-y-4 rounded-lg border p-4">
                        <p className="font-medium">
                          Course settings — {courseValue("title") as string}
                        </p>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Course title</Label>
                            <Input
                              value={(courseValue("title") as string) ?? ""}
                              onChange={(e) => editCourse({ title: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>URL slug</Label>
                            <Input
                              value={(courseValue("slug") as string) ?? ""}
                              onChange={(e) => editCourse({ slug: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Badge</Label>
                            <Input
                              placeholder="Foundation, Advanced, Practitioner"
                              value={(courseValue("badge") as string) ?? ""}
                              onChange={(e) => editCourse({ badge: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                              A label on the card. It grants nothing.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Instructor</Label>
                            <Input
                              placeholder="Grant Herbert"
                              value={(courseValue("instructor") as string) ?? ""}
                              onChange={(e) => editCourse({ instructor: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Total duration</Label>
                            <Input
                              placeholder="4h 30m total"
                              value={(courseValue("total_duration") as string) ?? ""}
                              onChange={(e) =>
                                editCourse({ total_duration: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Certificate code</Label>
                            <Input
                              placeholder="PSL-FDN"
                              value={(courseValue("code") as string) ?? ""}
                              onChange={(e) => editCourse({ code: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Description</Label>
                            <Textarea
                              rows={3}
                              value={(courseValue("description") as string) ?? ""}
                              onChange={(e) => editCourse({ description: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Course card image URL</Label>
                            <Input
                              placeholder="https://..."
                              value={(courseValue("image_url") as string) ?? ""}
                              onChange={(e) => editCourse({ image_url: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                              Shown on the Courses cards. Paste the link from
                              GoHighLevel Media Storage.
                            </p>
                            {courseValue("image_url") && (
                              <img
                                src={courseValue("image_url") as string}
                                alt=""
                                className="mt-2 max-h-48 rounded-md border object-cover"
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Entitlement, admins only */}
                      {isAdmin && (
                        <div className="space-y-3 rounded-lg border p-4">
                          <div>
                            <p className="font-medium">Who can take this course</p>
                            <p className="text-sm text-muted-foreground">
                              A course attached to no community is reachable by
                              nobody, which is how an unfinished course stays
                              hidden.
                            </p>
                          </div>
                          {communities.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between gap-4"
                            >
                              <Label htmlFor={`comm-${c.id}`}>
                                {c.name}
                                {c.is_free && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    free, everyone
                                  </span>
                                )}
                              </Label>
                              <Switch
                                id={`comm-${c.id}`}
                                checked={course.community_ids.includes(c.id)}
                                disabled={saving}
                                onCheckedChange={(v) => toggleCommunity(c.id, v)}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Lesson */}
                      {lesson && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Lesson title</Label>
                            <Input
                              value={(lessonValue("title") as string) ?? ""}
                              onChange={(e) => editLesson({ title: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Duration (e.g. 5:20)</Label>
                            <Input
                              value={(lessonValue("duration") as string) ?? ""}
                              onChange={(e) => editLesson({ duration: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Video className="h-4 w-4" aria-hidden="true" />
                              Media URL (MP4 or MP3)
                            </Label>
                            <Input
                              placeholder="https://... (.mp4 or .mp3 supported)"
                              value={(lessonValue("video_url") as string) ?? ""}
                              onChange={(e) => editLesson({ video_url: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                              Upload your file to GoHighLevel Media Storage and
                              paste the public URL here.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <ImageIcon className="h-4 w-4" aria-hidden="true" />
                              Thumbnail URL
                            </Label>
                            <Input
                              placeholder="https://... (.jpg or .png)"
                              value={(lessonValue("thumbnail_url") as string) ?? ""}
                              onChange={(e) =>
                                editLesson({ thumbnail_url: e.target.value })
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              Recommended size 1280×720 pixels, 16:9.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label>Lesson description</Label>
                            <Textarea
                              rows={5}
                              value={(lessonValue("description") as string) ?? ""}
                              onChange={(e) =>
                                editLesson({ description: e.target.value })
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between rounded-lg border p-4">
                            <div>
                              <Label htmlFor="published">Published</Label>
                              <p className="text-sm text-muted-foreground">
                                Unpublished lessons are visible to staff only.
                              </p>
                            </div>
                            <Switch
                              id="published"
                              checked={Boolean(lessonValue("is_published"))}
                              onCheckedChange={(v) => editLesson({ is_published: v })}
                            />
                          </div>

                          {/* Resources */}
                          <div className="space-y-3 rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                              <p className="flex items-center gap-2 font-medium">
                                <FileText className="h-4 w-4" aria-hidden="true" />
                                Resources and downloads
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  editLesson({
                                    resources: [
                                      ...resources,
                                      { title: "", type: "PDF", size: "", url: "" },
                                    ],
                                  })
                                }
                              >
                                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                                Add resource
                              </Button>
                            </div>

                            {resources.length === 0 && (
                              <p className="text-sm text-muted-foreground">
                                No resources on this lesson.
                              </p>
                            )}

                            {resources.map((r, i) => (
                              <div
                                key={i}
                                className="grid gap-3 rounded-md bg-muted/40 p-3 md:grid-cols-2"
                              >
                                <div className="space-y-1">
                                  <Label className="text-xs uppercase tracking-wide">
                                    Title
                                  </Label>
                                  <Input
                                    value={r.title}
                                    onChange={(e) =>
                                      setResource(i, { title: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs uppercase tracking-wide">
                                    Type
                                  </Label>
                                  <Input
                                    value={r.type ?? ""}
                                    onChange={(e) =>
                                      setResource(i, { type: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs uppercase tracking-wide">
                                    Size
                                  </Label>
                                  <Input
                                    placeholder="1.2 MB"
                                    value={r.size ?? ""}
                                    onChange={(e) =>
                                      setResource(i, { size: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs uppercase tracking-wide">
                                    File URL
                                  </Label>
                                  <Input
                                    placeholder="https://..."
                                    value={r.url}
                                    onChange={(e) =>
                                      setResource(i, { url: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      editLesson({
                                        resources: resources.filter((_, j) => j !== i),
                                      })
                                    }
                                  >
                                    <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end border-t pt-4">
                        <Button
                          variant="outline"
                          disabled={saving}
                          onClick={() =>
                            structural("Course deleted", async () =>
                              supabase.from("courses").delete().eq("id", course.id),
                            )
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                          Delete course
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Admin;
