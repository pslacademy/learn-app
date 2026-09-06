import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight, ShieldAlert } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { getProfile, type Profile } from "@/lib/account";
import { listCourses, type Course, type Lesson } from "@/lib/courses";
import { allCommunities, type Community } from "@/lib/communities";

/**
 * Admin, courses.
 *
 * Two levels of staff reach this page and they can do different things.
 * An editor builds content. Only an admin decides which communities reach a
 * course, because that is an entitlement decision rather than a content one.
 *
 * The interface hides what an editor may not do, and the database refuses it
 * regardless. Hiding a control is a courtesy; the policy is the rule.
 */
const Admin = () => {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [list, comms] = await Promise.all([listCourses(), allCommunities()]);
    setCourses(list);
    setCommunities(comms);
  };

  useEffect(() => {
    Promise.all([getProfile(), reload()]).then(([p]) => {
      setProfile(p);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </DashboardLayout>
    );
  }

  // Not staff. Sent away rather than shown an empty admin screen.
  if (!profile?.is_admin && !profile?.is_editor) {
    return <Navigate to="/dashboard" replace />;
  }

  const isAdmin = Boolean(profile.is_admin);

  const run = async (what: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      const result = (await fn()) as { error?: { message: string } };
      if (result?.error) throw new Error(result.error.message);
      await reload();
      toast({ title: what });
    } catch (e) {
      toast({
        variant: "destructive",
        title: `Could not ${what.toLowerCase()}`,
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const addCourse = () =>
    run("Course created", async () =>
      supabase.from("courses").insert({
        slug: `course-${Date.now()}`,
        title: "Untitled course",
        sort_order: courses.length + 1,
      }),
    );

  const saveCourse = (id: string, patch: Record<string, unknown>) =>
    run("Course saved", async () =>
      supabase.from("courses").update(patch).eq("id", id),
    );

  const deleteCourse = (id: string) =>
    run("Course deleted", async () =>
      supabase.from("courses").delete().eq("id", id),
    );

  const addModule = (courseId: string, count: number) =>
    run("Module added", async () =>
      supabase.from("course_modules").insert({
        course_id: courseId,
        title: "Untitled module",
        sort_order: count + 1,
      }),
    );

  const saveModule = (id: string, patch: Record<string, unknown>) =>
    run("Module saved", async () =>
      supabase.from("course_modules").update(patch).eq("id", id),
    );

  const deleteModule = (id: string) =>
    run("Module deleted", async () =>
      supabase.from("course_modules").delete().eq("id", id),
    );

  const addLesson = (courseId: string, moduleId: string, count: number) =>
    run("Lesson added", async () =>
      supabase.from("course_lessons").insert({
        course_id: courseId,
        module_id: moduleId,
        title: "Untitled lesson",
        sort_order: count + 1,
      }),
    );

  const saveLesson = (id: string, patch: Record<string, unknown>) =>
    run("Lesson saved", async () =>
      supabase.from("course_lessons").update(patch).eq("id", id),
    );

  const deleteLesson = (id: string) =>
    run("Lesson deleted", async () =>
      supabase.from("course_lessons").delete().eq("id", id),
    );

  const toggleCommunity = (courseId: string, communityId: string, on: boolean) =>
    run(on ? "Community attached" : "Community removed", async () =>
      on
        ? supabase
            .from("course_communities")
            .insert({ course_id: courseId, community_id: communityId })
        : supabase
            .from("course_communities")
            .delete()
            .eq("course_id", courseId)
            .eq("community_id", communityId),
    );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
            <p className="mt-1 text-muted-foreground">
              {isAdmin
                ? "Build courses and decide which communities reach them."
                : "Build and edit course content."}
            </p>
          </div>
          <Button onClick={addCourse} disabled={busy}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New course
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

        {courses.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              No courses yet. Create one to get started.
            </CardContent>
          </Card>
        )}

        {courses.map((course) => {
          const expanded = open === course.id;
          return (
            <Card key={course.id}>
              <CardHeader className="cursor-pointer" onClick={() => setOpen(expanded ? null : course.id)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {expanded ? (
                      <ChevronDown className="mt-1 h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-1 h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <CardTitle>{course.title}</CardTitle>
                      <CardDescription>
                        {course.modules.length} modules,{" "}
                        {course.modules.flatMap((m) => m.lessons).length} lessons,{" "}
                        {course.community_ids.length === 0
                          ? "reachable by nobody"
                          : `${course.community_ids.length} communities`}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {expanded && (
                <CardContent className="space-y-8">
                  {/* ---- The course itself ---- */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        defaultValue={course.title}
                        onBlur={(e) =>
                          e.target.value !== course.title &&
                          saveCourse(course.id, { title: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL slug</Label>
                      <Input
                        defaultValue={course.slug}
                        onBlur={(e) =>
                          e.target.value !== course.slug &&
                          saveCourse(course.id, { slug: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        rows={3}
                        defaultValue={course.description ?? ""}
                        onBlur={(e) =>
                          e.target.value !== (course.description ?? "") &&
                          saveCourse(course.id, { description: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Card image URL</Label>
                      <Input
                        placeholder="Paste the GHL Media Storage link"
                        defaultValue={course.image_url ?? ""}
                        onBlur={(e) =>
                          e.target.value !== (course.image_url ?? "") &&
                          saveCourse(course.id, { image_url: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  {/* ---- Entitlement. Admins only. ---- */}
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
                      {communities.map((c) => {
                        const on = course.community_ids.includes(c.id);
                        return (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-4"
                          >
                            <Label htmlFor={`${course.id}-${c.id}`}>
                              {c.name}
                              {c.is_free && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  free, everyone
                                </span>
                              )}
                            </Label>
                            <Switch
                              id={`${course.id}-${c.id}`}
                              checked={on}
                              disabled={busy}
                              onCheckedChange={(v) =>
                                toggleCommunity(course.id, c.id, v)
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ---- Modules and lessons ---- */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">Content</p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => addModule(course.id, course.modules.length)}
                      >
                        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                        Add module
                      </Button>
                    </div>

                    {course.modules.map((module) => (
                      <div key={module.id} className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center gap-3">
                          <Input
                            className="font-medium"
                            defaultValue={module.title}
                            onBlur={(e) =>
                              e.target.value !== module.title &&
                              saveModule(module.id, { title: e.target.value })
                            }
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={busy}
                            aria-label="Delete module"
                            onClick={() => deleteModule(module.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        {module.lessons.map((lesson: Lesson) => (
                          <div
                            key={lesson.id}
                            className="space-y-3 rounded-md bg-muted/40 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <Input
                                defaultValue={lesson.title}
                                onBlur={(e) =>
                                  e.target.value !== lesson.title &&
                                  saveLesson(lesson.id, { title: e.target.value })
                                }
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={busy}
                                aria-label="Delete lesson"
                                onClick={() => deleteLesson(lesson.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <Input
                                placeholder="Video URL"
                                defaultValue={lesson.video_url ?? ""}
                                onBlur={(e) =>
                                  e.target.value !== (lesson.video_url ?? "") &&
                                  saveLesson(lesson.id, { video_url: e.target.value })
                                }
                              />
                              <Input
                                placeholder="Duration, e.g. 18:24"
                                defaultValue={lesson.duration ?? ""}
                                onBlur={(e) =>
                                  e.target.value !== (lesson.duration ?? "") &&
                                  saveLesson(lesson.id, { duration: e.target.value })
                                }
                              />
                              <Input
                                className="md:col-span-2"
                                placeholder="Workbook URL, optional"
                                defaultValue={lesson.resources[0]?.url ?? ""}
                                onBlur={(e) => {
                                  const url = e.target.value.trim();
                                  const existing = lesson.resources[0]?.url ?? "";
                                  if (url === existing) return;
                                  saveLesson(lesson.id, {
                                    resources: url
                                      ? [{ title: "Workbook", url }]
                                      : [],
                                  });
                                }}
                              />
                              <Textarea
                                className="md:col-span-2"
                                rows={2}
                                placeholder="Lesson description, optional"
                                defaultValue={lesson.description ?? ""}
                                onBlur={(e) =>
                                  e.target.value !== (lesson.description ?? "") &&
                                  saveLesson(lesson.id, {
                                    description: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                        ))}

                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            addLesson(course.id, module.id, module.lessons.length)
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                          Add lesson
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end border-t pt-4">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => deleteCourse(course.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                      Delete course
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </DashboardLayout>
  );
};

export default Admin;
