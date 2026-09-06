import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, PlayCircle, Video } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listEvents, displayDate, isReplay, type AcademyEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

/**
 * Replays.
 *
 * The same events, after the fact. A session appears here once it has a
 * recording, which is why there is no separate replay record to create and
 * keep in step with the event it came from.
 *
 * Newest first, always. This is a library, not a curriculum: nobody starts at
 * the beginning, and the session somebody came for is almost always the most
 * recent one.
 */
const Replays = () => {
  const [events, setEvents] = useState<AcademyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState<AcademyEvent | null>(null);

  useEffect(() => {
    listEvents().then((list) => {
      const replays = list
        .filter((e) => e.isPublished && isReplay(e))
        .sort((a, b) => {
          const x = displayDate(a)?.getTime() ?? 0;
          const y = displayDate(b)?.getTime() ?? 0;
          return y - x;
        });
      setEvents(replays);
      setCurrent(replays[0] ?? null);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q),
    );
  }, [events, query]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Replays</h1>
          <p className="mt-1 text-muted-foreground">
            Recordings of past sessions, newest first. Watch any of them at any
            time.
          </p>
        </div>

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <Video className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="font-medium">No replays yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Recordings appear here after a session has run.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
            <div className="space-y-6">
              <div className="overflow-hidden rounded-xl bg-black">
                {current?.recordingUrl ? (
                  <video
                    key={current.id}
                    src={current.recordingUrl}
                    poster={current.imageUrl ?? undefined}
                    controls
                    controlsList="nodownload"
                    className="aspect-video w-full"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center text-sm text-white/70">
                    Select a replay
                  </div>
                )}
              </div>

              {current && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold">{current.title}</h2>
                    <p className="mt-1 text-muted-foreground">
                      {displayDate(current)?.toLocaleDateString("en-AU", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {current.description && (
                    <p className="whitespace-pre-line text-muted-foreground">
                      {current.description}
                    </p>
                  )}

                  {current.resources.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold">Workbook and resources</h3>
                      {current.resources.map((r) => (
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
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <aside className="space-y-3">
              <Input
                placeholder="Search replays"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              <div className="space-y-2">
                {filtered.length === 0 && (
                  <p className="px-1 py-4 text-sm text-muted-foreground">
                    Nothing matches that.
                  </p>
                )}

                {filtered.map((event) => {
                  const active = current?.id === event.id;
                  const when = displayDate(event);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setCurrent(event)}
                      className={cn(
                        "flex w-full gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted",
                        active && "border-primary bg-primary/5",
                      )}
                    >
                      <div className="shrink-0">
                        {event.imageUrl ? (
                          <img
                            src={event.imageUrl}
                            alt=""
                            className="h-14 w-24 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-24 items-center justify-center rounded bg-muted">
                            <PlayCircle
                              className="h-5 w-5 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm",
                            active ? "font-semibold" : "font-medium",
                          )}
                        >
                          {event.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {when?.toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {event.resources.length > 0 && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            Workbook
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Replays;
