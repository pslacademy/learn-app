import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Heart,
  Loader2,
  MessageSquare,
  Pin,
  PinOff,
  Send,
  Trash2,
  Pencil,
  Link as LinkIcon,
  Megaphone,
  HelpCircle,
  Trophy,
  ShieldCheck,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useToast } from "@/hooks/use-toast";
import { getProfile, type Profile } from "@/lib/account";
import { allCommunities, memberCommunityIds, type Community } from "@/lib/communities";
import {
  CHANNELS,
  listPosts,
  createPost,
  editPost,
  deletePost,
  setPinned,
  createComment,
  deleteComment,
  toggleHeart,
  mediaKind,
  authorName,
  authorInitials,
  spaceMembers,
  type Channel,
  type Post,
  type Comment,
  type Author,
} from "@/lib/community";
import { cn } from "@/lib/utils";
import { DirectoryList } from "@/components/community/DirectoryList";
import { Markdown, RichTextEditor, type MentionCandidate } from "@/components/RichText";
import { notifyForComment, notifyForPost } from "@/lib/notifications";

/**
 * The community space.
 *
 * A member has one space, so the switcher does not appear for them. The team
 * is in several and can read all of them, so they get a switcher listing every
 * community rather than a merged feed: a merged feed would show replies with
 * no context and invite posting into the wrong room.
 */

const timeAgo = (iso: string) => {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const Media = ({ url }: { url: string }) => {
  const kind = mediaKind(url);
  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        controlsList="nodownload"
        className="mt-3 aspect-video w-full rounded-lg bg-black"
      />
    );
  }
  if (kind === "image") {
    return <img src={url} alt="" className="mt-3 rounded-lg" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline"
    >
      <LinkIcon className="h-4 w-4" aria-hidden="true" />
      {url}
    </a>
  );
};

const AuthorLine = ({
  author,
  at,
  edited,
}: {
  author: Author | null;
  at: string;
  edited: string | null;
}) => (
  <div className="flex items-center gap-3">
    <Avatar className="h-9 w-9">
      <AvatarImage src={author?.avatar_url ?? undefined} />
      <AvatarFallback className="bg-primary/10 text-primary">
        {authorInitials(author)}
      </AvatarFallback>
    </Avatar>
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {authorName(author)}
        {(author?.is_admin || author?.is_editor) && (
          <Badge variant="secondary" className="text-xs">
            PSLA Team
          </Badge>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {author?.title ? `${author.title} • ` : ""}
        {timeAgo(at)}
        {edited ? " • edited" : ""}
      </p>
    </div>
  </div>
);

const CommunityPage = () => {
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [params, setParams] = useSearchParams();

  /*
    The space and the community both live in the URL rather than in state.
    The sidebar links to them, so holding them in component state would mean
    two places deciding what is on screen, and the sidebar highlighting one
    space while the page showed another.
  */
  const space = params.get("space");
  const channel = (space === "questions" || space === "wins"
    ? space
    : "announcements") as Channel;

  const [spaceId, setSpaceId] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [draft, setDraft] = useState("");
  const [draftMedia, setDraftMedia] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [commentMedia, setCommentMedia] = useState<Record<string, string>>({});
  const [mentionable, setMentionable] = useState<MentionCandidate[]>([]);

  const isTeam = Boolean(profile?.is_admin || profile?.is_editor);
  const isAdmin = Boolean(profile?.is_admin);

  useEffect(() => {
    Promise.all([getProfile(), allCommunities(), memberCommunityIds()]).then(
      ([p, all, mine]) => {
        setProfile(p);

        /* The team may read every space, so they choose. A member has one and
           does not need a chooser for it. */
        const visible =
          p?.is_admin || p?.is_editor
            ? all
            : all.filter((c) => mine.includes(c.id));

        setCommunities(visible);

        setLoading(false);
      },
    );
  }, []);

  const load = useCallback(async () => {
    if (!spaceId) return;
    setPosts(await listPosts(spaceId, channel));
  }, [spaceId, channel]);

  /*
    Follow the URL rather than reading it once.

    The sidebar changes the address; without this the page kept whichever
    community it happened to load with, so the switcher moved the address bar
    and left the heading and the feed showing the previous community.
  */
  useEffect(() => {
    if (communities.length === 0) return;
    const fromUrl = params.get("community");
    setSpaceId(
      fromUrl && communities.some((c) => c.id === fromUrl)
        ? fromUrl
        : (communities[0]?.id ?? null),
    );
  }, [params, communities]);

  useEffect(() => {
    if (spaceId && space && space !== "directory") load();
  }, [spaceId, channel, space, load]);

  /* Who can be named here. Reloaded when the space changes, because the @
     menu must never offer somebody the database would refuse to notify. */
  useEffect(() => {
    if (!spaceId) return;
    let cancelled = false;
    spaceMembers(spaceId).then((people) => {
      if (cancelled) return;
      setMentionable(
        people
          .filter((p) => p.first_name)
          .map((p) => ({
            id: p.id,
            name: [p.first_name, p.last_name].filter(Boolean).join(" "),
            title: p.title,
          })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const community = communities.find((c) => c.id === spaceId) ?? null;
  const canPost = channel !== "announcements" || isTeam;
  const canPin = channel === "announcements" ? isTeam : isAdmin;

  const run = async (
    fn: () => Promise<{ error: string | null }>,
    failure: string,
  ) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      toast({ variant: "destructive", title: failure, description: error });
      return false;
    }
    await load();
    return true;
  };

  const post = async () => {
    if (!draft.trim() || !spaceId) return;
    const ok = await run(
      () => createPost(spaceId, channel, draft, isTeam ? draftMedia : undefined),
      "Could not post",
    );
    if (ok) {
      setDraft("");
      setDraftMedia("");

      /* Tell anybody named. Asked for after the fact and allowed to fail
         quietly: the post is written either way, and a member who has said
         their piece must not be told otherwise because a bell did not ring. */
      const fresh = await listPosts(spaceId, channel);
      const mine = fresh.find((x) => x.author_id === profile?.id);
      if (mine) await notifyForPost(mine.id);
    }
  };

  const comment = async (postId: string) => {
    const text = commentDraft[postId] ?? "";
    if (!text.trim()) return;
    const ok = await run(
      () => createComment(postId, text, isTeam ? commentMedia[postId] : undefined),
      "Could not comment",
    );
    if (ok) {
      setCommentDraft((d) => ({ ...d, [postId]: "" }));
      setCommentMedia((d) => ({ ...d, [postId]: "" }));

      const fresh = await listPosts(spaceId!, channel);
      const parent = fresh.find((x) => x.id === postId);
      const mine = parent?.comments
        .filter((c) => c.author_id === profile?.id)
        .slice(-1)[0];
      if (mine) await notifyForComment(mine.id);
    }
  };

  const heart = (
    target: { postId?: string; commentId?: string },
    hearted: boolean,
  ) => run(() => toggleHeart(target, hearted), "Could not do that");

  const channelInfo = useMemo(
    () => CHANNELS.find((c) => c.value === channel),
    [channel],
  );

  if (loading) {
    return (
      <DashboardLayout>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </DashboardLayout>
    );
  }

  if (!community) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-md space-y-3 py-16 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="text-xl font-semibold">No space yet</h1>
          <p className="text-muted-foreground">
            Your community space is being set up. It will appear here.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold tracking-tight">
          Community
          <Badge variant="outline" className="text-xs uppercase tracking-wide">
            {community.name}
          </Badge>
        </h1>
        <p className="mt-1 text-muted-foreground">
          {space ? channelInfo?.blurb : "Stay updated, and join the conversation."}
        </p>
      </div>
    </div>
  );

  /* No space chosen: the overview. Somebody arriving from the sidebar header
     should be told what the three channels are for before being dropped into
     one of them. */
  if (!space) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {header}

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-2xl font-bold text-primary">
                Welcome to your {community.name} community
              </h2>
              <p className="text-muted-foreground">
                A space to connect with the people on the same road as you.
              </p>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    icon: Megaphone,
                    space: "announcements",
                    title: "Announcements",
                    blurb:
                      "News, events and updates from the PSLA team.",
                  },
                  {
                    icon: HelpCircle,
                    space: "questions",
                    title: "Ask a Question",
                    blurb:
                      "Stuck on something? Ask the group. Somebody has usually been there.",
                  },
                  {
                    icon: Trophy,
                    space: "wins",
                    title: "Share a Win",
                    blurb:
                      "Something went well. Say so, with people who understand why it mattered.",
                  },
                ].map((c) => (
                  <Link
                    key={c.space}
                    to={`/community?space=${c.space}&community=${spaceId}`}
                    className="rounded-lg border bg-card p-5 transition-colors hover:border-primary/40"
                  >
                    <c.icon className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
                    <p className="font-semibold">{c.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{c.blurb}</p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-6">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                Community guidelines
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Be respectful.</strong>{" "}
                  Treat everyone with kindness. Harassment and discrimination
                  are not tolerated.
                </li>
                <li>
                  <strong className="text-foreground">Keep it in the room.</strong>{" "}
                  What is shared here stays here. Respect the privacy of your
                  peers.
                </li>
                <li>
                  <strong className="text-foreground">No self-promotion.</strong>{" "}
                  This is not a place to sell to each other.
                </li>
                <li>
                  <strong className="text-foreground">Be useful.</strong>{" "}
                  When you answer, answer to help rather than to be right.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  /* The directory, inside Community rather than beside it, as in EI Academy. */
  if (space === "directory") {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {header}
          <DirectoryList
            communityId={community.id}
            communityName={community.name}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {header}

        {canPost ? (
          <Card>
            <CardContent className="space-y-3 p-4">
              <RichTextEditor
                rows={4}
                placeholder={
                  channel === "announcements"
                    ? "Post an announcement to this community"
                    : channel === "questions"
                      ? "What would you like to ask?"
                      : "What went well?"
                }
                value={draft}
                onChange={setDraft}
                mentions={mentionable}
              />
              {/* Media is the team's, because there is no upload path and the
                  database strips it from anyone else. Hiding the field saves
                  a member typing into something that would be discarded. */}
              {isTeam && (
                <Input
                  placeholder="Image or video URL, optional"
                  value={draftMedia}
                  onChange={(e) => setDraftMedia(e.target.value)}
                />
              )}
              <div className="flex justify-end">
                <Button onClick={post} disabled={busy || !draft.trim()}>
                  {busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Post
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <p className="rounded-lg border bg-muted/60 p-4 text-sm text-muted-foreground">
            Announcements come from the PSLA team. You can join the conversation
            in Ask a Question and Share a Win.
          </p>
        )}

        {posts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Nothing here yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {canPost
                  ? "Be the first to post."
                  : "Announcements will appear here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => {
              const mine = p.author_id === profile?.id;
              return (
                <Card key={p.id} className={cn(p.is_pinned && "border-primary/40")}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <AuthorLine author={p.author} at={p.created_at} edited={p.edited_at} />
                      <div className="flex items-center gap-1">
                        {p.is_pinned && (
                          <Badge variant="secondary" className="gap-1">
                            <Pin className="h-3 w-3" aria-hidden="true" />
                            Pinned
                          </Badge>
                        )}
                        {canPin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy}
                            aria-label={p.is_pinned ? "Unpin" : "Pin"}
                            onClick={() =>
                              run(
                                () => setPinned(p.id, !p.is_pinned),
                                "Could not change that",
                              )
                            }
                          >
                            {p.is_pinned ? (
                              <PinOff className="h-4 w-4" />
                            ) : (
                              <Pin className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {mine && (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busy}
                            aria-label="Edit post"
                            onClick={() => {
                              setEditing(p.id);
                              setEditText(p.content);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {(mine || isAdmin) && (
                          <ConfirmDelete
                            name="this post"
                            consequence={
                              p.comments.length > 0
                                ? `Its ${p.comments.length} comment${p.comments.length === 1 ? "" : "s"} go too.`
                                : undefined
                            }
                            onConfirm={async () => {
                              await run(() => deletePost(p.id), "Could not delete");
                            }}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={busy}
                              aria-label="Delete post"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </ConfirmDelete>
                        )}
                      </div>
                    </div>

                    {editing === p.id ? (
                      <div className="space-y-2">
                        <RichTextEditor
                          rows={4}
                          value={editText}
                          onChange={setEditText}
                          mentions={mentionable}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={async () => {
                              const ok = await run(
                                () => editPost(p.id, editText),
                                "Could not save",
                              );
                              if (ok) setEditing(null);
                            }}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Markdown text={p.content} />
                    )}

                    {p.media_url && <Media url={p.media_url} />}

                    <div className="flex items-center gap-4 border-t pt-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => heart({ postId: p.id }, p.hearted)}
                        className={cn(
                          "flex items-center gap-1.5 text-sm transition-colors",
                          p.hearted
                            ? "text-primary"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Heart
                          className={cn("h-4 w-4", p.hearted && "fill-current")}
                          aria-hidden="true"
                        />
                        {p.hearts > 0 ? p.hearts : ""}
                        <span className="sr-only">
                          {p.hearted ? "Remove heart" : "Heart this post"}
                        </span>
                      </button>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MessageSquare className="h-4 w-4" aria-hidden="true" />
                        {p.comments.length}
                      </span>
                    </div>

                    {p.comments.length > 0 && (
                      <div className="space-y-3 border-t pt-3">
                        {p.comments.map((c: Comment) => {
                          const myComment = c.author_id === profile?.id;
                          return (
                            <div key={c.id} className="space-y-2 pl-2">
                              <div className="flex items-start justify-between gap-3">
                                <AuthorLine
                                  author={c.author}
                                  at={c.created_at}
                                  edited={c.edited_at}
                                />
                                {(myComment || isAdmin) && (
                                  <ConfirmDelete
                                    name="this comment"
                                    onConfirm={async () => {
                                      await run(
                                        () => deleteComment(c.id),
                                        "Could not delete",
                                      );
                                    }}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={busy}
                                      aria-label="Delete comment"
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </ConfirmDelete>
                                )}
                              </div>
                              <div className="pl-12">
                                <Markdown text={c.content} />
                              </div>
                              {c.media_url && (
                                <div className="pl-12">
                                  <Media url={c.media_url} />
                                </div>
                              )}
                              <div className="pl-12">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    heart({ commentId: c.id }, c.hearted)
                                  }
                                  className={cn(
                                    "flex items-center gap-1.5 text-xs transition-colors",
                                    c.hearted
                                      ? "text-primary"
                                      : "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  <Heart
                                    className={cn(
                                      "h-3.5 w-3.5",
                                      c.hearted && "fill-current",
                                    )}
                                    aria-hidden="true"
                                  />
                                  {c.hearts > 0 ? c.hearts : ""}
                                  <span className="sr-only">
                                    {c.hearted ? "Remove heart" : "Heart this comment"}
                                  </span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-2 border-t pt-3">
                      <RichTextEditor
                        rows={2}
                        placeholder="Write a comment"
                        value={commentDraft[p.id] ?? ""}
                        onChange={(v) =>
                          setCommentDraft((d) => ({ ...d, [p.id]: v }))
                        }
                        mentions={mentionable}
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={busy || !(commentDraft[p.id] ?? "").trim()}
                          onClick={() => comment(p.id)}
                        >
                          <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                          Comment
                        </Button>
                      </div>
                      {isTeam && (
                        <Input
                          placeholder="Image or video URL, optional"
                          value={commentMedia[p.id] ?? ""}
                          onChange={(e) =>
                            setCommentMedia((d) => ({ ...d, [p.id]: e.target.value }))
                          }
                        />
                      )}
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

export default CommunityPage;
