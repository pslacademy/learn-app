import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus, Save, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  listEvents,
  startDateMismatch,
  type AcademyEvent,
} from "@/lib/events";
import { type Community } from "@/lib/communities";
import type { Resource } from "@/lib/courses";
import {
  WEEKDAYS,
  ORDINALS,
  DEFAULT_RULE,
  describeRecurrence,
  type RecurrenceRule,
  type Freq,
} from "@/lib/recurrence";
import { TIMEZONES } from "@/data/geo";
import { cn } from "@/lib/utils";

/**
 * Events, in Admin.
 *
 * One record covers a session and, later, its recording. Pasting a recording
 * URL into a past session is what puts it in the Replays library: there is no
 * second thing to create and nothing to keep in step.
 */
interface Props {
  isAdmin: boolean;
  communities: Community[];
}

export const EventsAdmin = ({ isAdmin, communities }: Props) => {
  const { toast } = useToast();
  const [events, setEvents] = useState<AcademyEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<AcademyEvent>>({});

  const reload = async (keep = true) => {
    const list = await listEvents();
    setEvents(list);
    setDraft({});
    if (!keep || !list.some((e) => e.id === selectedId)) {
      setSelectedId(list[0]?.id ?? null);
    }
  };

  useEffect(() => {
    reload(false).then(() => setLoading(false));
  }, []);

  const event = events.find((e) => e.id === selectedId) ?? null;

  const value = <K extends keyof AcademyEvent>(key: K): AcademyEvent[K] | undefined =>
    event ? ((draft[key] ?? event[key]) as AcademyEvent[K]) : undefined;

  const edit = (patch: Partial<AcademyEvent>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const rule: RecurrenceRule = (value("recurrence") as RecurrenceRule) ?? DEFAULT_RULE;
  const editRule = (patch: Partial<RecurrenceRule>) =>
    edit({ recurrence: { ...rule, ...patch } });

  const resources: Resource[] = (value("resources") as Resource[]) ?? [];
  const setResource = (i: number, patch: Partial<Resource>) =>
    edit({ resources: resources.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  const run = async (what: string, fn: () => Promise<{ error?: unknown }>) => {
    setSaving(true);
    try {
      const { error } = await fn();
      if (error) throw new Error((error as { message: string }).message);
      await reload();
      toast({ title: what });
    } catch (e) {
      toast({
        variant: "destructive",
        title: `Could not ${what.toLowerCase()}`,
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const addEvent = () =>
    run("Event created", async () =>
      supabase.from("events").insert({
        title: "Untitled session",
        start_date: new Date().toISOString().slice(0, 10),
        start_time: "09:30",
        is_published: false,
      }),
    );

  const save = () => {
    if (!event) return;
    return run("Event saved", async () =>
      supabase
        .from("events")
        .update({
          title: value("title"),
          description: value("description"),
          start_date: value("startDate"),
          start_time: value("startTime"),
          end_time: value("endTime") || null,
          timezone: value("timezone"),
          location: value("location"),
          event_type: value("eventType"),
          image_url: value("imageUrl"),
          join_url: value("joinUrl"),
          is_recurring: value("isRecurring"),
          recurrence_pattern: value("isRecurring")
            ? describeRecurrence({
                isRecurring: true,
                recurrence: rule,
                startDate: value("startDate") as string,
                startTime: value("startTime") as string,
              })
            : null,
          recurrence: value("isRecurring") ? rule : null,
          recording_url: value("recordingUrl"),
          resources,
          is_published: value("isPublished"),
        })
        .eq("id", event.id),
    );
  };

  const toggleCommunity = (communityId: string, on: boolean) =>
    event
      ? run(on ? "Community attached" : "Community removed", async () =>
          on
            ? supabase
                .from("event_communities")
                .insert({ event_id: event.id, community_id: communityId })
            : supabase
                .from("event_communities")
                .delete()
                .eq("event_id", event.id)
                .eq("community_id", communityId),
        )
      : undefined;

  if (loading) {
    return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
      <Card className="h-fit">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Sessions</h2>
            <Button size="sm" variant="outline" onClick={addEvent} disabled={saving}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New
            </Button>
          </div>

          {events.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No sessions yet. Create one to begin.
            </p>
          )}

          <div className="space-y-1">
            {events.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  setSelectedId(e.id);
                  setDraft({});
                }}
                className={cn(
                  "w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted",
                  selectedId === e.id &&
                    "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                <span className="block font-medium">{e.title}</span>
                <span
                  className={cn(
                    "block text-xs",
                    selectedId === e.id
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground",
                  )}
                >
                  {e.startDate}
                  {e.recordingUrl ? " • recorded" : ""}
                  {!e.isPublished ? " • draft" : ""}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-8 p-6">
          {!event ? (
            <p className="py-12 text-center text-muted-foreground">
              Create a session to begin.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">
                  Editing: {value("title") as string}
                </h2>
                <Button onClick={save} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Save session
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Title</Label>
                  <Input
                    value={(value("title") as string) ?? ""}
                    onChange={(e) => edit({ title: e.target.value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    rows={3}
                    value={(value("description") as string) ?? ""}
                    onChange={(e) => edit({ description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={(value("startDate") as string) ?? ""}
                    onChange={(e) => edit({ startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={(value("timezone") as string) ?? "Australia/Sydney"}
                    onValueChange={(v) => edit({ timezone: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The session's own time. Members elsewhere are shown their
                    equivalent as well.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Start time</Label>
                  <Input
                    type="time"
                    value={(value("startTime") as string) ?? ""}
                    onChange={(e) => edit({ startTime: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>End time</Label>
                  <Input
                    type="time"
                    value={(value("endTime") as string) ?? ""}
                    onChange={(e) => edit({ endTime: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    placeholder="Zoom"
                    value={(value("location") as string) ?? ""}
                    onChange={(e) => edit({ location: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Input
                    placeholder="Virtual, Workshop, Masterclass"
                    value={(value("eventType") as string) ?? ""}
                    onChange={(e) => edit({ eventType: e.target.value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Join URL</Label>
                  <Input
                    placeholder="https://zoom.us/j/..."
                    value={(value("joinUrl") as string) ?? ""}
                    onChange={(e) => edit({ joinUrl: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown to members from five minutes before the start, and
                    not before.
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Image URL</Label>
                  <Input
                    placeholder="https://... (.jpg or .png)"
                    value={(value("imageUrl") as string) ?? ""}
                    onChange={(e) => edit({ imageUrl: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown on the Events card and behind the replay player.
                    Upload to GoHighLevel Media Storage and paste the public URL
                    here. Recommended size 1280×720 pixels, 16:9.
                  </p>
                  {value("imageUrl") && (
                    <img
                      src={value("imageUrl") as string}
                      alt=""
                      className="mt-2 aspect-video max-w-sm rounded-md border object-cover"
                    />
                  )}
                </div>
              </div>

              {/* ---- Recurrence ---- */}
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="recurring">Repeats</Label>
                    <p className="text-sm text-muted-foreground">
                      One record, not one per month. Correcting the title
                      corrects every occurrence.
                    </p>
                  </div>
                  <Switch
                    id="recurring"
                    checked={Boolean(value("isRecurring"))}
                    onCheckedChange={(v) => edit({ isRecurring: v })}
                  />
                </div>

                {value("isRecurring") && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-2">
                        <Label>Every</Label>
                        <Input
                          type="number"
                          min={1}
                          className="w-24"
                          value={rule.interval}
                          onChange={(e) =>
                            editRule({
                              interval: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Period</Label>
                        <Select
                          value={rule.freq}
                          onValueChange={(v) => editRule({ freq: v as Freq })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">Days</SelectItem>
                            <SelectItem value="week">Weeks</SelectItem>
                            <SelectItem value="month">Months</SelectItem>
                            <SelectItem value="year">Years</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {rule.freq === "week" && (
                      <div className="space-y-2">
                        <Label>On</Label>
                        <div className="flex flex-wrap gap-2">
                          {WEEKDAYS.map((d) => {
                            const on = (rule.weekdays ?? []).includes(d.value);
                            return (
                              <button
                                key={d.value}
                                type="button"
                                aria-label={d.label}
                                aria-pressed={on}
                                onClick={() =>
                                  editRule({
                                    weekdays: on
                                      ? (rule.weekdays ?? []).filter(
                                          (x) => x !== d.value,
                                        )
                                      : [...(rule.weekdays ?? []), d.value],
                                  })
                                }
                                className={cn(
                                  "h-9 w-9 rounded-full border text-sm font-medium transition-colors",
                                  on
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "hover:bg-muted",
                                )}
                              >
                                {d.short}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Leave all unselected to repeat on the same weekday as
                          the start date.
                        </p>
                      </div>
                    )}

                    {rule.freq === "month" && (
                      <div className="space-y-3">
                        <Select
                          value={rule.monthMode ?? "day"}
                          onValueChange={(v) =>
                            editRule({ monthMode: v as "day" | "weekday" })
                          }
                        >
                          <SelectTrigger className="w-72">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">On the same date each month</SelectItem>
                            <SelectItem value="weekday">On a weekday of the month</SelectItem>
                          </SelectContent>
                        </Select>

                        {rule.monthMode === "weekday" && (
                          <div className="flex flex-wrap gap-3">
                            <Select
                              value={String(rule.ordinal ?? 1)}
                              onValueChange={(v) =>
                                editRule({ ordinal: Number(v) })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ORDINALS.map((o) => (
                                  <SelectItem key={o.value} value={String(o.value)}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select
                              value={String(rule.weekday ?? 1)}
                              onValueChange={(v) =>
                                editRule({ weekday: Number(v) })
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {WEEKDAYS.map((d) => (
                                  <SelectItem key={d.value} value={String(d.value)}>
                                    {d.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-3">
                      <Label>Ends</Label>
                      <div className="flex flex-wrap items-center gap-3">
                        <Select
                          value={rule.endMode}
                          onValueChange={(v) =>
                            editRule({ endMode: v as "never" | "on" | "after" })
                          }
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="never">Never</SelectItem>
                            <SelectItem value="on">On a date</SelectItem>
                            <SelectItem value="after">After a number</SelectItem>
                          </SelectContent>
                        </Select>

                        {rule.endMode === "on" && (
                          <Input
                            type="date"
                            className="w-48"
                            value={rule.endDate ?? ""}
                            onChange={(e) => editRule({ endDate: e.target.value })}
                          />
                        )}

                        {rule.endMode === "after" && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              className="w-24"
                              value={rule.count ?? 1}
                              onChange={(e) =>
                                editRule({
                                  count: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                            />
                            <span className="text-sm text-muted-foreground">
                              occurrences
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="rounded-md bg-muted/60 p-3 text-sm">
                      {describeRecurrence({
                        isRecurring: true,
                        recurrence: rule,
                        startDate: value("startDate") as string,
                        startTime: value("startTime") as string,
                      })}
                    </p>

                    {/* The date typed need not satisfy the rule chosen. That
                        is allowed, and everything downstream copes, but it
                        should be said out loud here rather than discovered in
                        somebody's calendar. */}
                    {(() => {
                      const first = startDateMismatch(
                        value("startDate") as string,
                        value("startTime") as string,
                        true,
                        rule,
                      );
                      if (!first) return null;

                      const typed = new Date(
                        `${value("startDate")}T${value("startTime")}:00`,
                      );
                      const fmt = (d: Date) =>
                        d.toLocaleDateString("en-AU", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        });

                      return (
                        <div className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                          <AlertTriangle
                            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                            aria-hidden="true"
                          />
                          <p>
                            This starts on {fmt(typed)}, which does not match the
                            pattern above. The first session will be{" "}
                            <strong>{fmt(first)}</strong>. Change the date if
                            that is not what you meant.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* ---- The recording ---- */}
              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    <Video className="h-4 w-4" aria-hidden="true" />
                    Recording
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Paste the link after the session has run. That is what puts
                    it in the Replays library.
                  </p>
                </div>

                <Input
                  placeholder="https://... (.mp4)"
                  value={(value("recordingUrl") as string) ?? ""}
                  onChange={(e) => edit({ recordingUrl: e.target.value })}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Workbook and resources</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        edit({
                          resources: [
                            ...resources,
                            { title: "", type: "PDF", size: "", url: "" },
                          ],
                        })
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                      Add resource
                    </Button>
                  </div>

                  {resources.map((r, i) => (
                    <div
                      key={i}
                      className="grid gap-3 rounded-md bg-muted/40 p-3 md:grid-cols-2"
                    >
                      <div className="space-y-1">
                        <Label className="text-xs uppercase tracking-wide">Title</Label>
                        <Input
                          value={r.title}
                          onChange={(e) => setResource(i, { title: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs uppercase tracking-wide">Type</Label>
                        <Input
                          value={r.type ?? ""}
                          onChange={(e) => setResource(i, { type: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs uppercase tracking-wide">Size</Label>
                        <Input
                          placeholder="1.2 MB"
                          value={r.size ?? ""}
                          onChange={(e) => setResource(i, { size: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs uppercase tracking-wide">
                          File URL
                        </Label>
                        <Input
                          placeholder="https://..."
                          value={r.url}
                          onChange={(e) => setResource(i, { url: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            edit({ resources: resources.filter((_, j) => j !== i) })
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ---- Audience. Admins only. ---- */}
              {isAdmin && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Who can see this session</p>
                    <p className="text-sm text-muted-foreground">
                      Attach none and every signed-in member sees it. Attach one
                      or more and only those members do.
                    </p>
                  </div>
                  {communities.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-4">
                      <Label htmlFor={`ev-${c.id}`}>
                        {c.name}
                        {c.is_free && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            free, everyone
                          </span>
                        )}
                      </Label>
                      <Switch
                        id={`ev-${c.id}`}
                        checked={event.communityIds.includes(c.id)}
                        disabled={saving}
                        onCheckedChange={(v) => toggleCommunity(c.id, v)}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between border-t pt-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id="published"
                    checked={Boolean(value("isPublished"))}
                    onCheckedChange={(v) => edit({ isPublished: v })}
                  />
                  <Label htmlFor="published">Published</Label>
                </div>

                <ConfirmDelete
                  name={(value("title") as string) || "this session"}
                  consequence="Its recording link and resources go too."
                  onConfirm={() =>
                    run("Event deleted", async () =>
                      supabase.from("events").delete().eq("id", event.id),
                    )
                  }
                >
                  <Button variant="outline" disabled={saving}>
                    <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                    Delete session
                  </Button>
                </ConfirmDelete>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EventsAdmin;
