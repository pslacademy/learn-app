import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  PlayCircle,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BRAND } from "@/config/brand";
import { getProfile, type Profile } from "@/lib/account";
import { listCourses, type Course } from "@/lib/courses";
import { myCommunities, type Community } from "@/lib/communities";
import {
  loadProgress,
  onProgressChange,
  courseProgress,
  isLessonComplete,
  nextLesson,
} from "@/lib/progress";

const Dashboard = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  const [, tick] = useState(0);
  useEffect(() => onProgressChange(() => tick((n) => n + 1)), []);

  useEffect(() => {
    Promise.all([getProfile(), listCourses(), myCommunities(), loadProgress()]).then(
      ([p, list, comms]) => {
        setProfile(p);
        setCourses(list);
        setCommunities(comms);
        setLoading(false);
      },
    );
  }, []);

  const mine = courses.filter((c) => c.unlocked);
  const allLessons = mine.flatMap((c) => c.modules.flatMap((m) => m.lessons));
  const lessonsDone = allLessons.filter((l) => isLessonComplete(l.id)).length;
  const modulesDone = mine
    .flatMap((c) => c.modules)
    .filter(
      (m) => m.lessons.length > 0 && m.lessons.every((l) => isLessonComplete(l.id)),
    ).length;
  const coursesDone = mine.filter((c) => courseProgress(c) === 100).length;

  /* What to pick up. The first course that is started but unfinished, else
     the first unstarted one. Nothing to resume is a real state, not zero. */
  const resume =
    mine.find((c) => {
      const pct = courseProgress(c);
      return pct > 0 && pct < 100;
    }) ?? mine.find((c) => courseProgress(c) === 0);

  const upNext = resume ? nextLesson(resume) : null;
  const upNextModule = resume?.modules.find((m) =>
    m.lessons.some((l) => l.id === upNext?.id),
  );

  const stats = [
    { icon: Clock, label: "Courses available", value: mine.length },
    { icon: CheckCircle2, label: "Lessons completed", value: lessonsDone },
    { icon: Trophy, label: "Modules completed", value: modulesDone },
    { icon: TrendingUp, label: "Courses completed", value: coursesDone },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome to {BRAND.name}
              {profile?.first_name ? `, ${profile.first_name}` : ""}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {communities.length > 0
                ? `You are in ${communities.map((c) => c.name).join(", ")}.`
                : "Your membership is being set up."}
            </p>
          </div>
          {resume && (
            <Button asChild>
              <Link to={`/courses/${resume.slug}`}>
                <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                Resume learning
              </Link>
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-lg bg-primary/10 p-3">
                  <s.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">
                    {loading ? "—" : s.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : mine.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">No courses yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Courses will appear here as they are published to your
                communities.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {resume && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Continue learning</h2>
                <Card className="overflow-hidden">
                  {resume.image_url && (
                    <img
                      src={resume.image_url}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  )}
                  <CardContent className="space-y-3 p-6">
                    {resume.badge && (
                      <Badge variant="secondary" className="w-fit">
                        {resume.badge}
                      </Badge>
                    )}
                    <h3 className="text-lg font-bold">{resume.title}</h3>
                    {resume.description && (
                      <p className="text-sm text-muted-foreground">
                        {resume.description}
                      </p>
                    )}
                    <div className="space-y-1 pt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {courseProgress(resume)}%
                        </span>
                      </div>
                      <Progress value={courseProgress(resume)} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {upNext && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Up next</h2>
                <Card className="overflow-hidden">
                  {(upNext.thumbnail_url || resume?.image_url) && (
                    <img
                      src={upNext.thumbnail_url ?? resume?.image_url ?? ""}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  )}
                  <CardContent className="space-y-2 p-6">
                    {upNextModule && (
                      <p className="text-sm text-muted-foreground">
                        {upNextModule.title}
                      </p>
                    )}
                    <h3 className="text-lg font-bold">{upNext.title}</h3>
                    {upNext.duration && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        {upNext.duration}
                      </p>
                    )}
                    <Button asChild className="mt-2 w-full">
                      <Link to={`/courses/${resume?.slug}`}>
                        <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                        Play lesson
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {resume && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Your learning journey</h2>
                <Card>
                  <CardContent className="space-y-4 p-6">
                    <p className="text-sm text-muted-foreground">{resume.title}</p>
                    {resume.modules.map((m) => {
                      const total = m.lessons.length;
                      const done = m.lessons.filter((l) =>
                        isLessonComplete(l.id),
                      ).length;
                      const state =
                        total > 0 && done === total
                          ? "done"
                          : done > 0
                            ? "doing"
                            : "todo";

                      return (
                        <div key={m.id} className="flex gap-3">
                          {state === "done" ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          ) : state === "doing" ? (
                            <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          ) : (
                            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{m.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {m.lessons.map((l) => l.title).join(", ") ||
                                "No lessons yet"}
                            </p>
                            {state === "doing" && (
                              <p className="mt-0.5 text-xs font-medium text-primary">
                                In progress
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
