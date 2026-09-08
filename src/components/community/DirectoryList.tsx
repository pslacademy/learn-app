import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MapPin, Search, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { COUNTRIES } from "@/data/geo";
import { communityDirectory, type DirectoryMember } from "@/lib/community";

/**
 * The members of one community.
 *
 * Scoped to the community being viewed rather than left to row level
 * security. The policy answers "may I see this person", which for an admin is
 * everybody, so relying on it showed the same list under every community and
 * put people in rooms they are not in.
 *
 * Membership is exclusive: somebody who buys leaves the free community, so
 * each list is genuinely that room and not a filtered view of everyone.
 *
 * The email address is deliberately not requested. Members who want to be
 * contacted can turn on direct messages; a directory is not a mailing list.
 */
export const DirectoryList = ({
  communityId,
  communityName,
}: {
  communityId: string;
  communityName: string;
}) => {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    communityDirectory(communityId).then((rows) => {
      if (cancelled) return;
      setMembers(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [communityId]);

  const countryName = (code: string | null) =>
    code ? (COUNTRIES.find((c) => c.value === code)?.label ?? code) : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = `${m.first_name ?? ""} ${m.last_name ?? ""}`.toLowerCase();
      return (
        name.includes(q) ||
        (m.title ?? "").toLowerCase().includes(q) ||
        (m.bio ?? "").toLowerCase().includes(q) ||
        (countryName(m.location) ?? "").toLowerCase().includes(q)
      );
    });
  }, [members, query]);

  if (loading) {
    return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-6">
      {members.length > 0 && (
        <div className="flex justify-end">
          <div className="relative min-w-[260px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              placeholder="Search by name, role or country"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Nobody in {communityName} yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Members appear here as they join. Somebody who has opted out of
              the directory is not listed.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Nobody matches that.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "member" : "members"}
          </p>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => {
              const name =
                [m.first_name, m.last_name].filter(Boolean).join(" ") || "A member";
              const initials =
                `${m.first_name?.[0] ?? ""}${m.last_name?.[0] ?? ""}` || "?";
              const country = countryName(m.location);

              return (
                <Card key={m.id}>
                  <CardContent className="space-y-3 p-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={m.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{name}</p>
                        {m.title && (
                          <p className="truncate text-sm text-muted-foreground">
                            {m.title}
                          </p>
                        )}
                        {country && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" aria-hidden="true" />
                            {country}
                          </p>
                        )}
                      </div>
                    </div>

                    {m.bio && (
                      <p className="line-clamp-4 text-sm text-muted-foreground">
                        {m.bio}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <p className="text-sm text-muted-foreground">
        You can take yourself out of this list under{" "}
        <Button asChild variant="link" className="h-auto p-0">
          <Link to="/settings?tab=notifications">Settings, Notifications</Link>
        </Button>
        .
      </p>
    </div>
  );
};

export default DirectoryList;
