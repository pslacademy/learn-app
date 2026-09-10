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
  Lock,
  GraduationCap,
  Send,
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
import { getProfile } from "@/lib/account";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  questionsOf,
  isAssessment,
  mySubmissions,
  submitAssessment,
  saveDraft,
  downloadSubmission,
  openModules,
  type Question,
  type Submission,
} from "@/lib/assessments";

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
/**
 * An assessment, in the place the video would be.
 *
 * Answers are not marked and nothing is right or wrong, which the heading
 * says out loud: somebody who thinks they are being tested writes what they
 * think scores well rather than what is true.
 *
 * Resubmitting replaces the previous answer rather than adding a second one,
 * so somebody who wants to think again can.
 */
const AssessmentForm = ({
  lesson,
  courseId,
  courseTitle,
  memberName,
  existing,
  answers,
  setAnswers,
  submitting,
  onSubmit,
}: {
  lesson: Lesson;
  courseId: string;
  courseTitle: string;
  memberName: string;
  existing?: Submission;
  answers: Record<string, string>;
  setAnswers: (a: Record<string, string>) => void;
  submitting: boolean;
  onSubmit: () => void;
}) => {
  const questions = questionsOf(lesson);

  /* Start from what they wrote last time, so revisiting shows their answers
     rather than an empty form that looks like the submission was lost. */
  useEffect(() => {
    setAnswers(existing?.answers ?? {});
  }, [lesson.id, existing, setAnswers]);

  const answered = questions.filter((q) => (answers[q.id] ?? "").trim()).length;
  const ready = answered === questions.length;

  /*
    Saved a second after they stop typing, not on every keystroke: one is a
    request a minute, the other is a request per character.

    Skipped once it has been submitted, so revisiting a finished assessment
    and reading it back does not quietly turn it into a draft again and close
    the next module.
  */
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (existing && !existing.is_draft) return;
    if (Object.keys(answers).length === 0) return;

    const timer = window.setTimeout(async () => {
      await saveDraft(courseId, lesson, answers);
      setSavedAt(new Date());
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [answers, courseId, lesson, existing]);

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="flex items-start gap-3">
          <GraduationCap className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-xl font-bold">{lesson.title}</h2>
            <p className="text-sm text-muted-foreground">
              Nothing here is marked and there are no wrong answers. Your
              responses are read by the team, and submitting opens the next
              module.
            </p>
          </div>
        </div>

        {existing && (
          <p className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
            You submitted this on{" "}
            {new Date(existing.submitted_at).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            . You can change your answers and submit again.
          </p>
        )}

        <div className="space-y-6">
          {questions.map((q: Question, i: number) => (
            <div key={q.id} className="space-y-2">
              <p className="font-medium">
                {i + 1}. {q.prompt}
              </p>

              {q.type === "choice" ? (
                <div className="space-y-2">
                  {(q.options ?? []).map((option) => (
                    <label
                      key={option}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-muted",
                        answers[q.id] === option && "border-primary bg-primary/5",
                      )}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={option}
                        checked={answers[q.id] === option}
                        onChange={() => setAnswers({ ...answers, [q.id]: option })}
                        className="accent-current"
                      />
                      {option}
                    </label>
                  ))}
                </div>
              ) : (
                <Textarea
                  rows={4}
                  placeholder="Your answer"
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [q.id]: e.target.value })
                  }
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {answered} of {questions.length} answered
            {savedAt && !(existing && !existing.is_draft) && (
              <span className="ml-2">
                • saved{" "}
                {savedAt.toLocaleTimeString("en-AU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
          {existing && !existing.is_draft && (
            <Button
              variant="outline"
              onClick={() => {
                void downloadSubmission(
                  existing,
                  courseTitle,
                  lesson.title,
                  memberName,
                );
              }}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Download
            </Button>
          )}
          <Button onClick={onSubmit} disabled={submitting || !ready}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {existing ? "Submit again" : "Submit"}
          </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const CoursePlayer = () => {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [current, setCurrent] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Map<string, Submission>>(new Map());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isTeam, setIsTeam] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [, tick] = useState(0);
  useEffect(() => onProgressChange(() => tick((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    if (!slug) return;
    Promise.all([
      getCourse(slug),
      loadProgress(),
      mySubmissions(),
      getProfile(),
    ]).then(([c, , subs, profile]) => {
      if (cancelled) return;
      setCourse(c);
      setSubmissions(subs);
      setIsTeam(Boolean(profile?.is_admin || profile?.is_editor));
      setMemberName(
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
          (profile?.email ?? ""),
      );
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

  const open = openModules(course, submissions, isTeam);

  /* A closed module's lessons are not offered. The rows are still there and
     the database still returns them: this is pacing, not a gate, and saying
     so in a comment is better than implying a security boundary that is not
     there. */
  const lessons = orderedLessons(course).filter((l) =>
    l.module_id ? open.has(l.module_id) : true,
  );
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
          {current && isAssessment(current) ? (
            <AssessmentForm
              lesson={current}
              courseId={course.id}
              courseTitle={course.title}
              memberName={memberName}
              existing={submissions.get(current.id)}
              answers={answers}
              setAnswers={setAnswers}
              submitting={submitting}
              onSubmit={async () => {
                setSubmitting(true);
                const { error } = await submitAssessment(course.id, current, answers);
                setSubmitting(false);

                if (error) {
                  toast({
                    variant: "destructive",
                    title: "Not submitted",
                    description: error,
                  });
                  return;
                }

                /*
                  Submitting is finishing it.
                  
                  Marking the lesson complete separately was a step nobody
                  should have to take: they have done the work, and leaving
                  the tick to them meant a module that was finished still
                  read as unfinished, and a certificate that never arrived.
                */
                await markLessonComplete(course.id, current.id);
                setSubmissions(await mySubmissions());

                toast({
                  title: "Submitted",
                  description: "Lesson marked complete. The next module is now open.",
                });
              }}
            />
          ) : (
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
          )}

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
            {course.modules.map((module) => {
              const locked = !open.has(module.id);
              return (
              <AccordionItem
                key={module.id}
                value={module.id}
                className={cn(
                  "rounded-xl border bg-card px-4",
                  locked && "opacity-70",
                )}
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  <span className="flex items-center gap-2">
                    {locked && (
                      <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                    {module.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  {/* Why it is closed, rather than a lock with no explanation.
                      Somebody who cannot see the reason assumes it is broken. */}
                  {locked ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      Finish the assessment in the previous module to open this
                      one.
                    </p>
                  ) : (
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
                                {isAssessment(lesson) && (
                                  <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                                    Assessment
                                  </span>
                                )}
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
                  )}
                </AccordionContent>
              </AccordionItem>
              );
            })}
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
