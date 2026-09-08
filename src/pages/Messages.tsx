import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, MessageSquareOff, Search, Send, ShieldAlert } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { getProfile, type Profile } from "@/lib/account";
import {
  listContacts,
  listThread,
  sendMessage,
  markThreadRead,
  contactName,
  contactInitials,
  type Contact,
  type Message,
} from "@/lib/messages";
import { cn } from "@/lib/utils";

/**
 * Messages.
 *
 * A member sees the people in their communities. Somebody who has turned
 * direct messages off still appears, greyed, with the reason given: hiding
 * them would look like they had left the academy.
 *
 * The composer is hidden for those people as a courtesy. What actually stops
 * a message is the database, which refuses it whatever this screen does.
 */
const Messages = () => {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [thread, setThread] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);

  const bottom = useRef<HTMLDivElement>(null);

  /* The open conversation lives in the URL, so a link from the bell or the
     directory opens the right one and the back button behaves. */
  const activeId = params.get("with");
  const active = contacts.find((c) => c.id === activeId) ?? null;

  const refreshContacts = useCallback(async () => {
    setContacts(await listContacts());
  }, []);

  useEffect(() => {
    Promise.all([getProfile(), listContacts()]).then(([p, list]) => {
      setProfile(p);
      setContacts(list);
      setLoading(false);
    });
  }, []);

  const loadThread = useCallback(async () => {
    if (!activeId) {
      setThread([]);
      return;
    }
    setLoadingThread(true);
    const rows = await listThread(activeId);
    setThread(rows);
    setLoadingThread(false);

    /* Opening a conversation is reading it. */
    await markThreadRead(activeId);
    await refreshContacts();
  }, [activeId, refreshContacts]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  /*
    Live, unlike the bell.

    A conversation is the one place where a minute's delay is obviously wrong:
    two people are looking at the same screen at the same time. The
    subscription is scoped to the open conversation, and everything else still
    arrives through the bell.
  */
  useEffect(() => {
    if (!activeId || !profile) return;

    const channel = supabase
      .channel(`messages:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          const mine =
            (m.sender_id === profile.id && m.receiver_id === activeId) ||
            (m.sender_id === activeId && m.receiver_id === profile.id);
          if (!mine) return;

          setThread((current) =>
            current.some((x) => x.id === m.id) ? current : [...current, m],
          );
          if (m.receiver_id === profile.id) markThreadRead(activeId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, profile]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        contactName(c).toLowerCase().includes(q) ||
        (c.title ?? "").toLowerCase().includes(q),
    );
  }, [contacts, query]);

  const send = async () => {
    if (!draft.trim() || !active) return;
    setSending(true);
    const { error } = await sendMessage(active.id, draft);
    setSending(false);

    if (error) {
      toast({ variant: "destructive", title: "Not sent", description: error });
      return;
    }

    setDraft("");
    await loadThread();
    await refreshContacts();
  };

  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <DashboardLayout>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="mt-1 text-muted-foreground">
            Connect with the other members of your communities.
          </p>
        </div>

        {contacts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <MessageSquareOff
                className="h-8 w-8 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="font-medium">Nobody to message yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Other members of your communities will appear here as they join.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[340px,1fr]">
            {/* ---- Who ---- */}
            <Card className="overflow-hidden">
              <div className="border-b p-3">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    className="pl-9"
                    placeholder="Search members"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>

              <ScrollArea className="h-[28rem]">
                {filtered.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    Nobody matches that.
                  </p>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setParams({ with: c.id })}
                      className={cn(
                        "flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted",
                        activeId === c.id && "bg-primary/5",
                        !c.allow_messaging && "opacity-60",
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={c.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {contactInitials(c)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">
                            {contactName(c)}
                          </p>
                          {c.unread > 0 && (
                            <Badge className="h-5 min-w-5 justify-center px-1 text-[10px]">
                              {c.unread}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.lastMessage ?? "No messages yet"}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </Card>

            {/* ---- The conversation ---- */}
            <Card className="flex h-[32rem] flex-col overflow-hidden">
              {!active ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                  <MessageSquareOff
                    className="h-8 w-8 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <p className="text-muted-foreground">
                    Choose somebody to start a conversation.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 border-b p-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={active.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {contactInitials(active)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{contactName(active)}</p>
                      {active.title && (
                        <p className="text-sm text-muted-foreground">
                          {active.title}
                        </p>
                      )}
                    </div>
                  </div>

                  <ScrollArea className="flex-1 p-4">
                    {loadingThread ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : thread.length === 0 ? (
                      <p className="py-12 text-center text-sm text-muted-foreground">
                        No messages yet. Say hello.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {thread.map((m) => {
                          const mine = m.sender_id === profile?.id;
                          return (
                            <div
                              key={m.id}
                              className={cn(
                                "flex",
                                mine ? "justify-end" : "justify-start",
                              )}
                            >
                              <div
                                className={cn(
                                  "max-w-[75%] rounded-2xl px-4 py-2",
                                  mine
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted",
                                )}
                              >
                                <p className="whitespace-pre-line text-sm">
                                  {m.body}
                                </p>
                                <p
                                  className={cn(
                                    "mt-1 text-[10px]",
                                    mine
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {timeOf(m.created_at)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={bottom} />
                      </div>
                    )}
                  </ScrollArea>

                  {active.allow_messaging ? (
                    <div className="flex gap-2 border-t p-3">
                      <Input
                        placeholder="Type a message"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        onClick={send}
                        disabled={sending || !draft.trim()}
                        aria-label="Send message"
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    /* Said plainly rather than leaving a box that fails on
                       send. The rule applies to the team as well. */
                    <div className="flex items-start gap-3 border-t bg-muted/60 p-4 text-sm">
                      <ShieldAlert
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="text-muted-foreground">
                        {contactName(active)} has direct messages turned off, so
                        they cannot be reached here. You can still reply to them
                        in the community.
                      </p>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>
        )}

        {profile && !profile.allow_messaging && (
          <p className="text-sm text-muted-foreground">
            Your own direct messages are turned off, so nobody can start a
            conversation with you. Change that under{" "}
            <Button asChild variant="link" className="h-auto p-0">
              <Link to="/settings?tab=notifications">Settings, Notifications</Link>
            </Button>
            .
          </p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Messages;
