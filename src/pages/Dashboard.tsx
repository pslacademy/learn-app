import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShieldCheck, ArrowRight } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BRAND } from "@/config/brand";
import { getProfile, type Profile } from "@/lib/account";

/**
 * Phase 2 dashboard.
 *
 * Deliberately thin. Its job today is to prove a real session exists and
 * that the profile the server wrote is the one read back. Courses, community
 * and the rest arrive in later phases.
 */
const Dashboard = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, []);

  const name = profile?.first_name || "there";

  const completion =
    [
      profile?.first_name,
      profile?.last_name,
      profile?.email,
      profile?.bio,
      profile?.avatar_url,
    ].filter(Boolean).length * 20;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Hello, {name}
          </h1>
          <p className="mt-1 text-muted-foreground">
            You are signed in to {BRAND.name}.
          </p>
        </div>

        {/* Nobody goes back to a profile they skipped unless something asks
            them to. This is that prompt, and it goes once the profile is done. */}
        {!loading && completion < 100 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold">
                  Your profile is {completion}% complete
                </h3>
                <p className="text-sm text-muted-foreground">
                  Members with a picture and a bio get more out of the community.
                </p>
                <Progress value={completion} className="h-2 bg-primary/10" />
              </div>
              <Button asChild>
                <Link to="/settings">
                  Finish profile
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>What the server holds for you</CardTitle>
            <CardDescription>
              None of this can be changed from this browser. Communities and
              courses arrive in the next phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{profile?.email ?? "—"}</dd>

                <dt className="text-muted-foreground">CRM contact</dt>
                <dd className="font-mono text-xs">
                  {profile?.crm_contact_id ?? "not linked"}
                </dd>

                <dt className="text-muted-foreground">Administrator</dt>
                <dd className="font-medium">
                  {profile?.is_admin ? (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      Yes
                    </span>
                  ) : (
                    "No"
                  )}
                </dd>

                <dt className="text-muted-foreground">Tags last read</dt>
                <dd className="font-medium">
                  {profile?.communities_synced_at
                    ? new Date(profile.communities_synced_at).toLocaleString(
                        "en-AU",
                      )
                    : "never"}
                </dd>
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
