import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Loader2, Lock, BookOpen } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listCourses, purchaseUrlForCourse, type Course } from "@/lib/courses";
import {
  loadProgress,
  onProgressChange,
  courseProgress,
  courseCompletedCount,
} from "@/lib/progress";

/**
 * My courses.
 *
 * A locked course shows its title, description and image and nothing else,
 * because that is all the database returned. There is no client-side filter
 * deciding what to hide: the lesson rows never arrived.
 */
const Courses = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [buyLinks, setBuyLinks] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  const [, tick] = useState(0);
  useEffect(() => onProgressChange(() => tick((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listCourses(), loadProgress()]).then(async ([list]) => {
      if (cancelled) return;
      setCourses(list);
      setLoading(false);

      const links = await Promise.all(
        list
          .filter((c) => !c.unlocked)
          .map(async (c) => [c.id, await purchaseUrlForCourse(c)] as const),
      );
      if (!cancelled) setBuyLinks(Object.fromEntries(links));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const mine = courses.filter((c) => c.unlocked);
  const inProgress = mine.filter((c) => courseProgress(c) < 100);
  const finished = mine.filter((c) => courseProgress(c) === 100);
  const locked = courses.filter((c) => !c.unlocked);

  const CourseCard = ({ course }: { course: Course }) => {
    const pct = courseProgress(course);
    const done = courseCompletedCount(course);
    const total = course.modules.flatMap((m) => m.lessons).length;
    return (
      <Card className="flex flex-col overflow-hidden">
        {course.image_url ? (
          <img src={course.image_url} alt="" className="h-44 w-full object-cover" />
        ) : (
          <div className="flex h-44 w-full items-center justify-center bg-muted">
            <BookOpen className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        <CardContent className="flex flex-1 flex-col gap-4 p-6">
          {course.badge && (
            <Badge variant="secondary" className="w-fit">
              {course.badge}
            </Badge>
          )}

          <div className="space-y-2">
            <h3 className="text-xl font-bold">{course.title}</h3>
            {course.description && (
              <p className="text-sm text-muted-foreground">{course.description}</p>
            )}
          </div>

          <div className="mt-auto space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{pct}% complete</span>
              <span className="text-muted-foreground">
                {done}/{total} lessons
              </span>
            </div>
            <Progress value={pct} className="h-2" />

            <div className="flex items-center justify-between pt-1">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {course.total_duration ?? `${course.modules.length} modules`}
              </span>
              <Button asChild>
                <Link to={`/courses/${course.slug}`}>
                  {pct === 100 ? "Start over" : pct === 0 ? "Start" : "Continue"}
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My courses</h1>
          <p className="mt-1 text-muted-foreground">
            Track your progress and pick up where you left off.
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
                New courses will appear here as they are published.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="path" className="space-y-6">
            <TabsList>
              <TabsTrigger value="path">My learning path</TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({finished.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="path" className="space-y-8">
              {inProgress.length === 0 ? (
                <p className="text-muted-foreground">
                  Nothing in progress. Everything you have access to is finished.
                </p>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {inProgress.map((c) => (
                    <CourseCard key={c.id} course={c} />
                  ))}
                </div>
              )}

              {locked.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Also available</h2>
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
                              className="h-44 w-full object-cover opacity-60"
                            />
                          )}
                          <CardContent className="flex flex-1 flex-col gap-4 p-6">
                            <h3 className="flex items-start gap-2 text-xl font-bold">
                              <Lock
                                className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                              {course.title}
                            </h3>
                            {course.description && (
                              <p className="text-sm text-muted-foreground">
                                {course.description}
                              </p>
                            )}
                            <div className="mt-auto">
                              {buy ? (
                                <Button asChild variant="outline" className="w-full">
                                  <a href={buy} target="_blank" rel="noopener noreferrer">
                                    Find out more
                                  </a>
                                </Button>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Not part of your membership. Get in touch if you
                                  would like access.
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed">
              {finished.length === 0 ? (
                <p className="text-muted-foreground">
                  Nothing finished yet. Completed courses appear here.
                </p>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {finished.map((c) => (
                    <CourseCard key={c.id} course={c} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Courses;
