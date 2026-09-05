import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import { getProfile, signOut, type Profile } from "@/lib/account";

/**
 * Phase 2 dashboard.
 *
 * Deliberately plain. Its job today is to prove that a real session exists
 * and that the profile the server wrote is the one being read back. Courses,
 * community and the rest arrive in later phases.
 */
const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "there";

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <img
            src={BRAND.marks.logo}
            alt={BRAND.organisation}
            className="h-8 w-auto object-contain"
          />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/settings">Settings</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hello, {name}</h1>
          <p className="mt-1 text-muted-foreground">
            You are signed in to {BRAND.name}.
          </p>
        </div>

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">
              What the server holds for you
            </h2>
            <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
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
            <p className="mt-4 text-xs text-muted-foreground">
              None of the above can be changed from this browser. Communities
              and courses arrive in the next phase.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
