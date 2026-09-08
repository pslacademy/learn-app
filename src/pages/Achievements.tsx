import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  CheckCircle2,
  Download,
  Loader2,
  Lock,
  Trophy,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { listCourses, type Course } from "@/lib/courses";
import { loadProgress, onProgressChange } from "@/lib/progress";
import {
  getCertificates,
  claimCertificate,
  requirementsFor,
  moduleProgress,
  downloadCertificate,
  type Certificate,
} from "@/lib/achievements";

/**
 * Achievements.
 *
 * Two halves. In Progress lists each course with its modules as the
 * certification requirements, because completing every module is what earns
 * the certificate. Earned Credentials is what has been issued.
 *
 * A certificate is claimed on arriving here rather than at the moment the
 * last lesson is ticked. Watching the last lesson and being handed a
 * credential in the same instant is easy to miss; finding it waiting is not.
 * The database refuses the claim unless the work is actually done, so asking
 * costs nothing.
 */
const Achievements = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  const [, tick] = useState(0);
  useEffect(() => onProgressChange(() => tick((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [list] = await Promise.all([listCourses(), loadProgress()]);
      if (cancelled) return;
      setCourses(list);

      /* Ask for anything finished. Refused unless it has been, so this is
         safe to run every time and means nobody has to press a button to be
         given something they already earned. */
      const finished = list.filter(
        (c) => c.unlocked && moduleProgress(c) === 100,
      );
      await Promise.all(finished.map((c) => claimCertificate(c.id)));

      const certs = await getCertificates();
      if (cancelled) return;
      setCertificates(certs);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const mine = courses.filter((c) => c.unlocked);
  const certified = new Set(certificates.map((c) => c.course_id));
  const inProgress = mine.filter((c) => !certified.has(c.id));

  if (loading) {
    return (
      <DashboardLayout>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Achievements</h1>
          <p className="mt-1 text-muted-foreground">
            Your earned credentials, and how far you are towards the next.
          </p>
        </div>

        {mine.length === 0 && certificates.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <Trophy className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">Nothing yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Certificates appear here once you have completed every module of
                a course.
              </p>
            </CardContent>
          </Card>
        )}

        {inProgress.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">In progress</h2>

            {inProgress.map((course) => {
              const reqs = requirementsFor(course);
              const pct = moduleProgress(course);

              return (
                <Card key={course.id} className="overflow-hidden">
                  <div className="grid md:grid-cols-[280px,1fr]">
                    <div className="flex flex-col items-center justify-center gap-3 border-b bg-muted/30 p-8 text-center md:border-b-0 md:border-r">
                      <div className="rounded-full bg-primary/10 p-6">
                        <Award className="h-10 w-10 text-primary" aria-hidden="true" />
                      </div>
                      <p className="text-lg font-bold">{course.title}</p>
                      {course.description && (
                        <p className="text-sm text-muted-foreground">
                          {course.description}
                        </p>
                      )}
                    </div>

                    <CardContent className="space-y-4 p-6">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Certification requirements
                      </p>

                      {reqs.length === 0 ? (
                        /* A course with no modules cannot be certified, and
                           saying so is better than an empty list that looks
                           like something failed to load. */
                        <p className="text-sm text-muted-foreground">
                          This course has no modules, so there is no certificate
                          for it.
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {reqs.map((r) => (
                            <div key={r.id} className="flex items-start gap-2">
                              {r.complete ? (
                                <CheckCircle2
                                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Lock
                                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="text-sm">
                                {r.title}
                                <span className="block text-xs text-muted-foreground">
                                  {r.done} of {r.total} lessons
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {reqs.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">Overall progress</span>
                            <span className="font-bold text-primary">{pct}%</span>
                          </div>
                          <Progress value={pct} className="h-3" />
                        </div>
                      )}

                      <Button asChild variant="outline" size="sm">
                        <Link to={`/courses/${course.slug}`}>Continue course</Link>
                      </Button>
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </section>
        )}

        {certificates.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Earned credentials</h2>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {certificates.map((cert) => {
                const course = courses.find((c) => c.id === cert.course_id);
                return (
                  <Card key={cert.id} className="overflow-hidden">
                    <div className="relative flex aspect-video items-center justify-center bg-muted">
                      {course?.image_url && (
                        <img
                          src={course.image_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-25"
                        />
                      )}
                      <div className="relative rounded-full bg-primary p-5">
                        <Award
                          className="h-8 w-8 text-primary-foreground"
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    <CardContent className="space-y-3 p-6">
                      <p className="text-lg font-bold">{cert.course_title}</p>
                      {course?.description && (
                        <p className="text-sm text-muted-foreground">
                          {course.description}
                        </p>
                      )}

                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-semibold">Issued:</span>{" "}
                          {new Date(cert.issued_at).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            Credential ID:
                          </span>{" "}
                          <span className="font-mono text-xs">{cert.code}</span>
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => downloadCertificate(cert)}
                      >
                        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                        Download certificate
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Achievements;
