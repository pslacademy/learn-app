import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCourse, orderedLessons, type Course, type Lesson } from "@/lib/courses";
import {
  loadProgress,
  onProgressChange,
  isLessonComplete,
  markLessonComplete,
  markLessonIncomplete,
  courseProgress,
  nextLesson,
} from "@/lib/progress";
import { useToast } from "@/hooks/use-toast";

/**
 * The course player.
 *
 * Reaching this page for a course the member has not bought yields a course
 * with no modules, because the database returned none. That is handled as a
 * plain "not available" rather than as an error: a member who follows an old
 * link should be told, not shown a broken page.
 */
const CoursePlayer = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [current, setCurrent] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  const [, tick] = useState(0);
  useEffect(() => onProgressChange(() => tick((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    if (!slug) return;

    Promise.all([getCourse(slug), loadProgress()]).then(([c]) => {
      if (cancelled) return;
      setCourse(c);
      if (c) setCurrent(nextLesson(c));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <DashboardLayout>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </DashboardLayout>
    );
  }

  // Either no such course, or one this member cannot open. Deliberately the
  // same message for both, so a link cannot be used to discover what exists.
  if (!course || course.modules.length === 0) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-md space-y-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Course not available</h1>
          <p className="text-muted-foreground">
            This course is not part of your membership, or it is no longer
            published.
          </p>
          <Button asChild>
            <Link to="/courses">Back to courses</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const lessons = orderedLessons(course);
  const pct = courseProgress(course);
  const index = current ? lessons.findIndex((l) => l.id === current.id) : -1;
  const next = index >= 0 ? lessons[index + 1] : undefined;

  const toggleComplete = async (lesson: Lesson) => {
    if (isLessonComplete(lesson.id)) {
      await markLessonIncomplete(lesson.id);
      return;
    }

    const ok = await markLessonComplete(course.id, lesson.id);
    if (!ok) {
      toast({
        variant: "destructive",
        title: "Could not save that",
        description: "Your progress was not recorded. Please try again.",
      });
      return;
    }

    if (next) setCurrent(next);
  };

  return (
    <DashboardLayout fullWidth>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/courses")}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              All courses
            </Button>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              {course.title}
            </h1>
          </div>
          <div className="w-full md:w-64">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your progress</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,340px]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border bg-black">
              {current?.video_url ? (
                <video
                  key={current.id}
                  src={current.video_url}
                  poster={current.thumbnail_url ?? undefined}
                  controls
                  controlsList="nodownload"
                  className="aspect-video w-full"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center text-sm text-white/70">
                  No video on this lesson yet
                </div>
              )}
            </div>

            {current && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">{current.title}</h2>
                  {current.duration && (
                    <p className="text-sm text-muted-foreground">
                      {current.duration}
                    </p>
                  )}
                </div>

                {current.description && (
                  <p className="whitespace-pre-line text-muted-foreground">
                    {current.description}
                  </p>
                )}

                {current.resources.length > 0 && (
                  <Card>
                    <CardContent className="space-y-2 p-4">
                      <p className="text-sm font-medium">Resources</p>
                      {current.resources.map((r) => (
                        <a
                          key={r.url}
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          {r.title}
                          {r.size && (
                            <span className="text-muted-foreground">({r.size})</span>
                          )}
                        </a>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => toggleComplete(current)}>
                    {isLessonComplete(current.id) ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                        Completed
                      </>
                    ) : (
                      "Mark as complete"
                    )}
                  </Button>
                  {next && (
                    <Button variant="outline" onClick={() => setCurrent(next)}>
                      Next lesson
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            {course.modules.map((module) => (
              <div key={module.id} className="rounded-xl border bg-card">
                <div className="border-b px-4 py-3">
                  <p className="font-semibold">{module.title}</p>
                </div>
                <ul>
                  {module.lessons.map((lesson) => {
                    const done = isLessonComplete(lesson.id);
                    const active = current?.id === lesson.id;
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          onClick={() => setCurrent(lesson)}
                          className={cn(
                            "flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted",
                            active && "bg-primary/10",
                          )}
                        >
                          {done ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          ) : active ? (
                            <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          ) : (
                            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="flex-1">
                            {lesson.title}
                            {lesson.duration && (
                              <span className="block text-xs text-muted-foreground">
                                {lesson.duration}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CoursePlayer;
