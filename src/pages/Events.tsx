import { useEffect, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  Video,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listEvents,
  displayDate,
  isUpcoming,
  isWithinJoinWindow,
  recurrenceLabel,
  formatTimes,
  type AcademyEvent,
} from "@/lib/events";
import { googleUrl, outlookUrl, yahooUrl, downloadIcs } from "@/lib/calendar";
import { getProfile } from "@/lib/account";
import { allCommunities, type Community } from "@/lib/communities";

/**
 * What is coming up.
 *
 * Every event here is one this member may attend: an event for a community
 * they are not in never arrives from the database, so there is no locked
 * state to render and no upgrade prompt to write.
 */
const Events = () => {
  const [events, setEvents] = useState<AcademyEvent[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listEvents(), allCommunities(), getProfile()]).then(
      ([list, comms, profile]) => {
        setEvents(list);
        setCommunities(comms);
        setTimezone(profile?.timezone ?? null);
        setLoading(false);
      },
    );
  }, []);

  const upcoming = events
    .filter((e) => e.isPublished && isUpcoming(e))
    .sort((a, b) => {
      const x = displayDate(a)?.getTime() ?? 0;
      const y = displayDate(b)?.getTime() ?? 0;
      return x - y;
    });

  const nameOf = (id: string) =>
    communities.find((c) => c.id === id)?.name ?? "Members";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="mt-1 text-muted-foreground">
            Live sessions and workshops. Recordings appear under Replays
            afterwards.
          </p>
        </div>

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : upcoming.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <CalendarDays
                className="h-8 w-8 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="font-medium">Nothing scheduled</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                There are no sessions coming up. New ones will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((event) => {
              const when = displayDate(event);
              const { eventTime, memberTime } = formatTimes(event, timezone);
              const repeats = recurrenceLabel(event);
              const canJoin = event.joinUrl && isWithinJoinWindow(event);

              return (
                <Card key={event.id} className="flex flex-col overflow-hidden">
                  {event.imageUrl && (
                    <img
                      src={event.imageUrl}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  )}

                  <CardContent className="flex flex-1 flex-col gap-4 p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      {when && (
                        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                          {when.toLocaleDateString("en-AU", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                      {repeats && (
                        <Badge variant="secondary" className="gap-1">
                          <RefreshCw className="h-3 w-3" aria-hidden="true" />
                          {repeats}
                        </Badge>
                      )}
                      {event.eventType && (
                        <Badge variant="outline">{event.eventType}</Badge>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h2 className="text-lg font-bold">{event.title}</h2>
                      {event.description && (
                        <p className="line-clamp-3 text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        {eventTime} {event.timezone.split("/").pop()?.replace("_", " ")}
                      </p>
                      {/* Only when it genuinely differs, so it is information
                          rather than noise for the majority in Sydney. */}
                      {memberTime && (
                        <p className="pl-6 text-xs">{memberTime}</p>
                      )}
                      {event.location && (
                        <p className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          {event.location}
                        </p>
                      )}
                    </div>

                    {event.communityIds.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {event.communityIds.map((id) => (
                          <Badge key={id} variant="outline" className="text-xs">
                            {nameOf(id)}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      {canJoin ? (
                        <Button asChild className="flex-1">
                          <a
                            href={event.joinUrl ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Video className="mr-2 h-4 w-4" aria-hidden="true" />
                            Join now
                          </a>
                        </Button>
                      ) : null}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="flex-1">
                            <CalendarPlus
                              className="mr-2 h-4 w-4"
                              aria-hidden="true"
                            />
                            Add to calendar
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              const url = googleUrl(event);
                              if (url) window.open(url, "_blank");
                            }}
                          >
                            Google Calendar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const url = outlookUrl(event);
                              if (url) window.open(url, "_blank");
                            }}
                          >
                            Outlook
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const url = yahooUrl(event);
                              if (url) window.open(url, "_blank");
                            }}
                          >
                            Yahoo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              downloadIcs(event, window.location.origin)
                            }
                          >
                            Apple Calendar, download .ics
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Events;
