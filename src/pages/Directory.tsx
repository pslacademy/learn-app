import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MapPin, Search, Users } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { COUNTRIES } from "@/data/geo";
import { allCommunities, type Community } from "@/lib/communities";

/**
 * The members' directory.
 *
 * Only paid communities produce one. Everyone signed in is in the free PSLA
 * Community, so a directory built on shared communities generally would hand
 * anyone who filled in the free form a browsable list of the entire
 * professional-services membership.
 *
 * There is no filtering in this file. The database returns exactly the people
 * this member may see, and if that is nobody, the page says so. A member
 * holding only the free community is told plainly why it is empty rather than
 * being shown an unexplained blank.
 *
 * The email address is deliberately not requested. Members who want to be
 * contacted can say so; a directory is not a mailing list.
 */
interface DirectoryMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  location: string | null;
  bio: string | null;
  avatar_url: string | null;
}

const Directory = () => {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [hasPaid, setHasPaid] = useState(false);
  const [paidNames, setPaidNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      const [{ data: paid }, { data, error }, comms] = await Promise.all([
        supabase.rpc("my_paid_community_ids"),
        supabase
          .from("profiles")
          .select("id, first_name, last_name, title, location, bio, avatar_url")
          .order("first_name"),
        allCommunities(),
      ]);

      setHasPaid((paid ?? []).length > 0);

      /* Named from the database rather than written into this file. The two
         paid communities were spelled out here and were already wrong once;
         two more are coming, and a hardcoded list would be wrong again. */
      setPaidNames(
        (comms as Community[])
          .filter((c) => !c.is_free && c.slug !== "team")
          .map((c) => c.name),
      );

      if (error) {
        console.error("Could not read the directory:", error.message);
        setLoading(false);
        return;
      }

      setMembers((data ?? []) as DirectoryMember[]);
      setLoading(false);
    };

    load();
  }, []);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Members</h1>
            <p className="mt-1 text-muted-foreground">
              Other members of the communities you belong to.
            </p>
          </div>

          {members.length > 0 && (
            <div className="relative min-w-[240px]">
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
          )}
        </div>

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : members.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
              <Users className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              {/* Two quite different reasons for an empty page, and a member
                  deserves to know which one applies to them. */}
              {hasPaid ? (
                <>
                  <p className="font-medium">Nobody else yet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    You are the first here. Other members will appear as they
                    join.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Nobody else here yet</p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    {paidNames.length > 0
                      ? `You will find more members inside ${paidNames.join(" and ")}.`
                      : "Other members will appear here as they join."}
                  </p>
                </>
              )}
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
                  [m.first_name, m.last_name].filter(Boolean).join(" ") ||
                  "A member";
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
    </DashboardLayout>
  );
};

export default Directory;
