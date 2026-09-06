import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronLeft,
  CheckCircle2,
  Circle,
  Download,
  FileText,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { BRAND } from "@/config/brand";
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
 * Deliberately outside the dashboard shell, like EI Academy: the sidebar and
 * header are replaced by a slim bar carrying the course name and progress, so
 * the video gets the room.
 *
 * Opening a course the member has not bought yields a course with no modules,
 * because the database returned none. Handled as "not available" rather than
 * as an error.
 */
const CoursePlayer = () => {
  const { slug } = useParams<{ slug: string }>();
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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Either no such course, or one this member cannot open. The same message
  // for both, so a link cannot be used to discover what exists.
  if (!course || course.modules.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">Course not available</h1>
        <p className="max-w-md text-muted-foreground">
          This course is not part of your membership, or it is no longer
          published.
        </p>
        <Button asChild>
          <Link to="/courses">Back to my courses</Link>
        </Button>
      </div>
    );
  }

  const lessons = orderedLessons(course);
  const pct = courseProgress(course);
  const index = current ? lessons.findIndex((l) => l.id === current.id) : -1;
  const next = index >= 0 ? lessons[index + 1] : undefined;

  const toggle = async (lesson: Lesson) => {
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b bg-card px-4 py-3 md:px-8">
        <Button asChild variant="ghost" size="icon" aria-label="Back to my courses">
          <Link to="/courses">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="flex-1 truncate text-lg font-bold">{course.title}</h1>
        <div className="hidden w-64 md:block">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your progress</span>
            <span className="font-semibold">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      </header>

      <div className="grid gap-6 p-4 md:p-6 lg:grid-cols-[1fr,380px]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl bg-black">
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
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">{current.title}</h2>
                  {course.instructor && (
                    <p className="mt-1 text-muted-foreground">
                      Instructor: {course.instructor}
                    </p>
                  )}
                </div>
                <Button
                  variant={isLessonComplete(current.id) ? "secondary" : "default"}
                  onClick={() => toggle(current)}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  {isLessonComplete(current.id) ? "Completed" : "Mark as complete"}
                </Button>
              </div>

              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="resources">
                    Resources
                    {current.resources.length > 0 && ` (${current.resources.length})`}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="pt-6">
                  <h3 className="mb-2 text-lg font-semibold">About this lesson</h3>
                  {current.description ? (
                    <p className="whitespace-pre-line text-muted-foreground">
                      {current.description}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      No description for this lesson.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="resources" className="space-y-3 pt-6">
                  {current.resources.length === 0 ? (
                    <p className="text-muted-foreground">
                      No downloads on this lesson.
                    </p>
                  ) : (
                    current.resources.map((r) => (
                      <div
                        key={r.url}
                        className="flex items-center justify-between gap-4 rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-md bg-muted p-2">
                            <FileText
                              className="h-5 w-5 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </div>
                          <div>
                            <p className="font-medium">{r.title || "Download"}</p>
                            <p className="text-sm text-muted-foreground">
                              {[r.type, r.size].filter(Boolean).join(" • ")}
                            </p>
                          </div>
                        </div>
                        <Button asChild variant="outline">
                          <a href={r.url} target="_blank" rel="noopener noreferrer">
                            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                            Download
                          </a>
                        </Button>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>

        <aside>
          <Accordion
            type="multiple"
            defaultValue={course.modules.map((m) => m.id)}
            className="space-y-3"
          >
            {course.modules.map((module) => (
              <AccordionItem
                key={module.id}
                value={module.id}
                className="rounded-xl border bg-card px-4"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  {module.title}
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <ul className="-mx-2">
                    {module.lessons.map((lesson) => {
                      const done = isLessonComplete(lesson.id);
                      const active = current?.id === lesson.id;
                      return (
                        <li key={lesson.id}>
                          <button
                            type="button"
                            onClick={() => setCurrent(lesson)}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted",
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
                              <span
                                className={cn(
                                  "block text-sm",
                                  active && "font-semibold",
                                )}
                              >
                                {lesson.title}
                              </span>
                              {lesson.duration && (
                                <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                  <PlayCircle className="h-3 w-3" aria-hidden="true" />
                                  {lesson.duration}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {BRAND.organisation}
          </p>
        </aside>
      </div>
    </div>
  );
};

export default CoursePlayer;
