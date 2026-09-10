import { useEffect, useMemo, useState } from "react";
import { Download, GraduationCap, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import {
  allSubmissions,
  downloadSubmission,
  type Submission,
  type Question,
} from "@/lib/assessments";
import { listCourses, type Course } from "@/lib/courses";
import { authorName, authorInitials, type Author } from "@/lib/community";

/**
 * Assessments, in Admin.
 *
 * What members wrote, most recent first. Read before a mentoring session.
 *
 * Nothing here is marked and nothing is editable, deliberately. These are
 * somebody's reflections on their own practice, and a screen that could
 * quietly change or remove them would make them worth less than the paper
 * they are not written on. The database has no delete policy for this table
 * at all, including for admins.
 */
export const AssessmentsAdmin = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [authors, setAuthors] = useState<Map<string, Author>>(new Map());
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    const [rows, courseList] = await Promise.all([allSubmissions(), listCourses()]);

    const ids = [...new Set(rows.map((r) => r.member_id))];
    const { data: people } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, title, avatar_url, is_admin, is_editor")
      .in("id", ids.length ? ids : ["none"]);

    setAuthors(new Map((people ?? []).map((p) => [p.id as string, p as Author])));
    setCourses(courseList);
    setSubmissions(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  /** Where a submission came from, for the filter and the label. */
  const placeOf = (s: Submission) => {
    const course = courses.find((c) => c.id === s.course_id);
    const module = course?.modules.find((m) =>
      m.lessons.some((l) => l.id === s.lesson_id),
    );
    const lesson = module?.lessons.find((l) => l.id === s.lesson_id);
    return {
      course: course?.title ?? "A course",
      module: module?.title ?? "",
      lesson: lesson?.title ?? "An assessment",
    };
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return submissions;

    return submissions.filter((s) => {
      const who = authorName(authors.get(s.member_id) ?? null).toLowerCase();
      const p = placeOf(s);
      return (
        who.includes(q) ||
        p.course.toLowerCase().includes(q) ||
        p.module.toLowerCase().includes(q) ||
        p.lesson.toLowerCase().includes(q)
      );
    });
  }, [submissions, authors, courses, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />
            Assessment submissions
          </h2>
          <p className="text-sm text-muted-foreground">
            What members wrote, most recent first. Read these before a mentoring
            session. Nothing is marked, and nothing here can be changed.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Refresh
        </Button>
      </div>

      {submissions.length > 0 && (
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            placeholder="Filter by member, course, module or lesson"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No assessments have been submitted yet.
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Nothing matches that.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((s) => {
            const who = authors.get(s.member_id) ?? null;
            const place = placeOf(s);

            return (
              <Card key={s.id}>
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={who?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {authorInitials(who)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{authorName(who)}</p>
                        <p className="text-sm text-muted-foreground">
                          {place.course}
                          {place.module ? ` • ${place.module}` : ""} • {place.lesson}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {new Date(s.submitted_at).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Download this submission"
                        onClick={() => {
                          void downloadSubmission(
                            s,
                            place.course,
                            place.lesson,
                            authorName(who),
                          );
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    {/* The questions as they stood when it was submitted, not
                        as they read now. An answer beneath a question that has
                        since been rewritten is worse than no answer at all. */}
                    {(s.questions ?? []).map((q: Question, i: number) => (
                      <div key={q.id} className="space-y-1">
                        <p className="text-sm font-medium">
                          {i + 1}. {q.prompt}
                        </p>
                        <p className="whitespace-pre-line rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                          {s.answers?.[q.id] || "No answer given."}
                        </p>
                      </div>
                    ))}

                    {(s.questions ?? []).length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        This submission has no recorded questions.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AssessmentsAdmin;
