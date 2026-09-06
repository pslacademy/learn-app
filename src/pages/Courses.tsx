import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Lock, PlayCircle, CheckCircle2, BookOpen } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { listCourses, purchaseUrlForCourse, type Course } from "@/lib/courses";
import {
  loadProgress,
  onProgressChange,
  courseProgress,
  courseCompletedCount,
} from "@/lib/progress";

/**
 * The course listing.
 *
 * A locked course shows its title, description and image, and nothing else,
 * because that is all the database gave us. There is no client-side filter
 * deciding what to hide: the lesson rows never arrived.
 */
const Courses = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [buyLinks, setBuyLinks] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  // Progress arrives separately, so re-render when it lands rather than
  // leaving a member who has done the work looking at zero.
  const [, tick] = useState(0);
  useEffect(() => onProgressChange(() => tick((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([listCourses(), loadProgress()]).then(async ([list]) => {
      if (cancelled) return;
      setCourses(list);
      setLoading(false);

      const locked = list.filter((c) => !c.unlocked);
      const links = await Promise.all(
        locked.map(async (c) => [c.id, await purchaseUrlForCourse(c)] as const),
      );
      if (!cancelled) setBuyLinks(Object.fromEntries(links));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const unlocked = courses.filter((c) => c.unlocked);
  const locked = courses.filter((c) => !c.unlocked);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Courses
          </h1>
          <p className="mt-1 text-muted-foreground">
            Work through a course at your own pace. Your progress is saved as
            you go.
          </p>
        </div>

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : courses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">No courses yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                There is nothing here at the moment. New courses will appear on
                this page as they are published.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {unlocked.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {unlocked.map((course) => {
                  const pct = courseProgress(course);
                  const done = courseCompletedCount(course);
                  const total = course.modules.flatMap((m) => m.lessons).length;

                  return (
                    <Card key={course.id} className="flex flex-col overflow-hidden">
                      {course.image_url && (
                        <img
                          src={course.image_url}
                          alt=""
                          className="h-40 w-full object-cover"
                        />
                      )}
                      <CardHeader>
                        <CardTitle className="text-lg">{course.title}</CardTitle>
                        {course.description && (
                          <CardDescription className="line-clamp-2">
                            {course.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="mt-auto space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {done} of {total} lessons
                            </span>
                            <span className="font-medium">{pct}%</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                        <Button asChild className="w-full">
                          <Link to={`/courses/${course.slug}`}>
                            {pct === 100 ? (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                Review
                              </>
                            ) : pct === 0 ? (
                              <>
                                <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                                Start
                              </>
                            ) : (
                              <>
                                <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                                Continue
                              </>
                            )}
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {locked.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Also available
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {locked.map((course) => {
                    const buy = buyLinks[course.id];
                    return (
                      <Card
                        key={course.id}
                        className="flex flex-col overflow-hidden border-dashed"
                      >
                        {course.image_url && (
                          <img
                            src={course.image_url}
                            alt=""
                            className="h-40 w-full object-cover opacity-60"
                          />
                        )}
                        <CardHeader>
                          <CardTitle className="flex items-start gap-2 text-lg">
                            <Lock
                              className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                            {course.title}
                          </CardTitle>
                          {course.description && (
                            <CardDescription className="line-clamp-2">
                              {course.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="mt-auto">
                          {buy ? (
                            <Button asChild variant="outline" className="w-full">
                              <a href={buy} target="_blank" rel="noopener noreferrer">
                                Find out more
                              </a>
                            </Button>
                          ) : (
                            /* No link rather than a dead button. A community
                               with nowhere to buy it yet says so. */
                            <p className="text-sm text-muted-foreground">
                              Not part of your membership. Get in touch if you
                              would like access.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Courses;
