import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  Pencil,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/account";
import type { Community } from "@/lib/communities";
import { cn } from "@/lib/utils";

/**
 * Member directory, in Admin.
 *
 * Read the whole membership, and suspend or reinstate. That is the entire
 * remit, deliberately.
 *
 * Roles are not editable here. is_admin and is_editor come from GoHighLevel
 * tags and nowhere else, so the CRM stays the single answer to who staff are.
 * A second way to grant admin would mean two sources of truth and, sooner or
 * later, an argument about which is right.
 *
 * Suspension is separate from is_active for the same reason in reverse:
 * is_active is the CRM's answer and the sync rewrites it, so suspending here
 * by setting is_active would last until the next sync and then quietly
 * reverse.
 */
interface Row extends Profile {
  communities: string[];
}

interface Props {
  communities: Community[];
}

export const MembersAdmin = ({ communities }: Props) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "staff" | "suspended" | "inactive">(
    "all",
  );
  const [target, setTarget] = useState<Row | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    const [{ data: profiles, error }, { data: links }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("member_communities").select("member_id, community_id"),
    ]);

    if (error) {
      toast({
        variant: "destructive",
        title: "Could not read the directory",
        description: error.message,
      });
      setLoading(false);
      return;
    }

    const byMember = new Map<string, string[]>();
    for (const l of links ?? []) {
      const list = byMember.get(l.member_id) ?? [];
      list.push(l.community_id);
      byMember.set(l.member_id, list);
    }

    setRows(
      (profiles ?? []).map((p) => ({
        ...(p as Profile),
        communities: byMember.get(p.id) ?? [],
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const nameOf = (id: string) =>
    communities.find((c) => c.id === id)?.name ?? "Unknown";

  const freeCommunity = communities.find((c) => c.is_free);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "staff" && !r.is_admin && !r.is_editor) return false;
      if (filter === "suspended" && !r.suspended_at) return false;
      if (filter === "inactive" && r.is_active) return false;
      if (!q) return true;
      const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.toLowerCase();
      return name.includes(q) || r.email.toLowerCase().includes(q);
    });
  }, [rows, query, filter]);

  const suspend = async () => {
    if (!target) return;
    setSaving(true);

    const { data: session } = await supabase.auth.getSession();
    const { error } = await supabase
      .from("profiles")
      .update({
        suspended_at: new Date().toISOString(),
        suspended_by: session?.session?.user?.id ?? null,
        suspended_reason: reason.trim() || null,
      })
      .eq("id", target.id);

    setSaving(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Could not suspend",
        description: error.message,
      });
      return;
    }

    setTarget(null);
    setReason("");
    await load();
    toast({
      title: "Suspended",
      description:
        "They can still sign in, but every page will be empty. Remove them in GoHighLevel to end the membership properly.",
    });
  };

  const reinstate = async (row: Row) => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ suspended_at: null, suspended_by: null, suspended_reason: null })
      .eq("id", row.id);
    setSaving(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Could not reinstate",
        description: error.message,
      });
      return;
    }

    await load();
    toast({ title: "Reinstated" });
  };

  const counts = {
    all: rows.length,
    staff: rows.filter((r) => r.is_admin || r.is_editor).length,
    suspended: rows.filter((r) => r.suspended_at).length,
    inactive: rows.filter((r) => !r.is_active).length,
  };

  if (loading) {
    return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            placeholder="Search by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Everyone"],
              ["staff", "Staff"],
              ["suspended", "Suspended"],
              ["inactive", "Not in the CRM"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={filter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(key)}
            >
              {label}
              <span className="ml-2 opacity-70">{counts[key]}</span>
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            {rows.length === 0
              ? "Nobody has an account yet."
              : "Nobody matches that."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const name =
              [row.first_name, row.last_name].filter(Boolean).join(" ") || "—";
            const initials =
              `${row.first_name?.[0] ?? ""}${row.last_name?.[0] ?? ""}` || "?";

            return (
              <Card
                key={row.id}
                className={cn(
                  row.suspended_at && "border-destructive/40 bg-destructive/5",
                  !row.is_active && "opacity-70",
                )}
              >
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={row.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{name}</p>
                      {row.is_admin && (
                        <Badge variant="secondary" className="gap-1">
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          Admin
                        </Badge>
                      )}
                      {row.is_editor && !row.is_admin && (
                        <Badge variant="secondary" className="gap-1">
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                          Editor
                        </Badge>
                      )}
                      {row.suspended_at && (
                        <Badge variant="destructive" className="gap-1">
                          <Ban className="h-3 w-3" aria-hidden="true" />
                          Suspended
                        </Badge>
                      )}
                      {!row.is_active && (
                        <Badge variant="outline" className="gap-1">
                          <UserX className="h-3 w-3" aria-hidden="true" />
                          Not in the CRM
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{row.email}</p>
                    {row.suspended_reason && (
                      <p className="mt-1 text-sm text-destructive">
                        {row.suspended_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex min-w-[200px] flex-wrap gap-1">
                    {/* Everyone signed in is in the free community, whether or
                        not they hold a tag, so it is shown rather than left
                        looking as though they belong to nothing. */}
                    {freeCommunity && (
                      <Badge variant="outline" className="text-xs">
                        {freeCommunity.name}
                      </Badge>
                    )}
                    {row.communities.map((id) => (
                      <Badge key={id} variant="outline" className="text-xs">
                        {nameOf(id)}
                      </Badge>
                    ))}
                  </div>

                  <div className="text-right text-xs text-muted-foreground">
                    <p>
                      {row.communities_synced_at
                        ? `Tags read ${new Date(row.communities_synced_at).toLocaleDateString("en-AU")}`
                        : "Never synced"}
                    </p>
                  </div>

                  <div>
                    {row.suspended_at ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => reinstate(row)}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                        Reinstate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => {
                          setTarget(row);
                          setReason("");
                        }}
                      >
                        <Ban className="mr-2 h-4 w-4 text-destructive" />
                        Suspend
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-lg border bg-muted/60 p-4 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p>
            Roles come from GoHighLevel tags and cannot be changed here. Apply
            <code className="mx-1 font-mono">psla admin</code> or
            <code className="mx-1 font-mono">psla editor</code> to their contact,
            and it takes effect when they next sign in.
          </p>
          <p className="text-muted-foreground">
            Not in the CRM means the sync could not find their contact, so their
            access has already ended. Suspended means you stopped them here, and
            a sync will not undo it.
          </p>
        </div>
      </div>

      <Dialog open={Boolean(target)} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Suspend {[target?.first_name, target?.last_name].filter(Boolean).join(" ") ||
                target?.email}?
            </DialogTitle>
            <DialogDescription>
              They keep their account and can still sign in, but every page will
              be empty until you reinstate them. To end a membership properly,
              remove their contact in GoHighLevel instead.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason, optional</Label>
            <Textarea
              id="reason"
              rows={3}
              placeholder="Recorded for your own reference. The member never sees it."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={suspend}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Ban className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MembersAdmin;
