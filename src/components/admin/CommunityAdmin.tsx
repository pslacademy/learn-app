import { useEffect, useState } from "react";
import {
  HelpCircle,
  Loader2,
  Megaphone,
  MessageSquare,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Markdown, RichTextEditor } from "@/components/RichText";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/account";
import type { Community } from "@/lib/communities";
import { authorName, authorInitials, type Author } from "@/lib/community";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Community, in Admin.
 *
 * Two jobs the community page itself cannot do well.
 *
 * Broadcasting: an announcement usually goes to several communities at once,
 * and doing that from the page means switching space and retyping it three
 * times, which is how three slightly different announcements happen.
 *
 * Triage: a question with no reply is invisible on a busy page and obvious
 * on a list. Once somebody from the team answers, it drops off, so the list
 * is a queue rather than an archive.
 */
interface Props {
  communities: Community[];
}

interface Waiting {
  id: string;
  community_id: string;
  content: string;
  created_at: string;
  author: Author | null;
  replies: number;
  answeredByTeam: boolean;
}

export const CommunityAdmin = ({ communities }: Props) => {
  const { toast } = useToast();

  const [targets, setTargets] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [media, setMedia] = useState("");
  const [sending, setSending] = useState(false);

  const [questions, setQuestions] = useState<Waiting[]>([]);
  const [showAnswered, setShowAnswered] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: posts }, { data: comments }] = await Promise.all([
      supabase
        .from("community_posts")
        .select("id, community_id, author_id, content, created_at")
        .eq("channel", "questions")
        .order("created_at", { ascending: false }),
      supabase.from("community_comments").select("post_id, author_id"),
    ]);

    const authorIds = [
      ...new Set([
        ...(posts ?? []).map((p) => p.author_id as string),
        ...(comments ?? []).map((c) => c.author_id as string),
      ]),
    ];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, title, avatar_url, is_admin, is_editor")
      .in("id", authorIds.length ? authorIds : ["none"]);

    const byId = new Map((profiles ?? []).map((p) => [p.id as string, p as Author]));

    setQuestions(
      (posts ?? []).map((p) => {
        const replies = (comments ?? []).filter((c) => c.post_id === p.id);
        return {
          id: p.id as string,
          community_id: p.community_id as string,
          content: p.content as string,
          created_at: p.created_at as string,
          author: byId.get(p.author_id as string) ?? null,
          replies: replies.length,
          /* Answered means somebody from the team replied. A member replying
             to another member is a conversation, not a resolution, and the
             question should stay on the queue until we have said something. */
          answeredByTeam: replies.some((c) => {
            const a = byId.get(c.author_id as string);
            return Boolean(a?.is_admin || a?.is_editor);
          }),
        };
      }),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const nameOf = (id: string) =>
    communities.find((c) => c.id === id)?.name ?? "Unknown community";

  const broadcast = async () => {
    if (!message.trim() || targets.length === 0) return;
    setSending(true);

    const profile = await getProfile();
    if (!profile) {
      setSending(false);
      return;
    }

    /*
      One row per community rather than one post shown in several places.
      A post belongs to a space: sharing a single row across spaces would mean
      comments from one community appearing in another, which is exactly what
      separate spaces are for preventing.
    */
    const { error } = await supabase.from("community_posts").insert(
      targets.map((community_id) => ({
        community_id,
        channel: "announcements" as const,
        author_id: profile.id,
        content: message.trim(),
        media_url: media.trim() || null,
      })),
    );

    setSending(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Could not post",
        description: error.message,
      });
      return;
    }

    setMessage("");
    setMedia("");
    toast({
      title: "Announcement posted",
      description: `Sent to ${targets.length} ${targets.length === 1 ? "community" : "communities"}.`,
    });
  };

  const visible = showAnswered
    ? questions
    : questions.filter((q) => !q.answeredByTeam);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Megaphone className="h-5 w-5 text-primary" aria-hidden="true" />
              Post an announcement
            </h2>
            <p className="text-sm text-muted-foreground">
              Broadcast to one or more communities at once.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Communities</Label>
            <div className="flex flex-wrap gap-4">
              {communities.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={targets.includes(c.id)}
                    onCheckedChange={(v) =>
                      setTargets((t) =>
                        v ? [...t, c.id] : t.filter((x) => x !== c.id),
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="announcement">Message</Label>
            <RichTextEditor
              id="announcement"
              rows={6}
              placeholder="Type your announcement here"
              value={message}
              onChange={setMessage}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="announcement-media">Image or video URL, optional</Label>
            <Input
              id="announcement-media"
              placeholder="https://..."
              value={media}
              onChange={(e) => setMedia(e.target.value)}
            />
          </div>

          <Button
            onClick={broadcast}
            disabled={sending || !message.trim() || targets.length === 0}
          >
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Post announcement
          </Button>
          {targets.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Choose at least one community.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <HelpCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                Questions waiting on a reply
              </h2>
              <p className="text-sm text-muted-foreground">
                Once somebody from the team answers, the question drops off this
                list.
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowAnswered((v) => !v)}>
              {showAnswered ? "Hide answered" : "Show answered"}
            </Button>
          </div>

          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {showAnswered
                ? "No questions have been asked yet."
                : "Nothing waiting on a reply. Use Show answered to see the rest."}
            </p>
          ) : (
            <div className="space-y-3">
              {visible.map((q) => (
                <div
                  key={q.id}
                  className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="flex min-w-0 flex-1 gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={q.author?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {authorInitials(q.author)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {authorName(q.author)}
                        <Badge variant="outline" className="text-xs">
                          {nameOf(q.community_id)}
                        </Badge>
                        {q.answeredByTeam && (
                          <Badge variant="secondary" className="text-xs">
                            Answered
                          </Badge>
                        )}
                      </p>
                      <div className="mt-1 text-muted-foreground">
                        <Markdown text={q.content} />
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" aria-hidden="true" />
                        {q.replies} {q.replies === 1 ? "reply" : "replies"}
                        {" • "}
                        {new Date(q.created_at).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Answering happens in the space, where the thread is.
                      A reply box here would show the question without the
                      conversation around it. */}
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`/community?space=questions&community=${q.community_id}`}
                    >
                      Open and reply
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CommunityAdmin;
