import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getProfile, syncFromCrm, type Profile } from "@/lib/account";

/**
 * Route protection based on a real session.
 *
 * It asks Supabase whether there is a valid signed session, and takes the
 * admin flag and is_active from the profiles table, where they are written by
 * the server from the member's GoHighLevel tags and cannot be updated by the
 * member. Nothing in the address bar and nothing in the browser's own storage
 * confers identity.
 */

/** How long a CRM reading stays good enough. */
const CRM_MAX_AGE_MS = 4 * 60 * 60 * 1000;

/**
 * Ask the CRM again if what we hold is old.
 *
 * Deliberately quiet and non-blocking: it never delays the page, and a CRM
 * that cannot be reached changes nothing. Tags read only at sign-in would
 * reach a member who stays signed in for months not at all, so removing a tag
 * would never take effect. Throttled, because otherwise this is a call to the
 * CRM on every page load, and a few hours is soon enough.
 */
const refreshIfStale = async (profile: Profile | null) => {
  if (!profile) return;

  const syncedAt = profile.communities_synced_at;
  const age = syncedAt ? Date.now() - new Date(syncedAt).getTime() : Infinity;
  if (age < CRM_MAX_AGE_MS) return;

  await syncFromCrm();
};

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<"checking" | "out" | "in" | "suspended">(
    "checking",
  );

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!data?.session) {
        setState("out");
        return;
      }

      const p = await getProfile();
      if (cancelled) return;

      /*
        A suspended account may not use the academy.

        is_active is set to false only when the CRM gives a definite answer
        that the contact is gone, never when it simply could not be reached.
      */
      if (p && p.is_active === false) {
        await supabase.auth.signOut();
        if (cancelled) return;
        setState("suspended");
        return;
      }

      setState("in");

      refreshIfStale(p);
    };

    check();

    // Signing out in another tab should take effect here too.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setState("out");
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "suspended") {
    // Sent to the sign-in page with a reason, rather than bounced silently to
    // a form that would appear to work and then not.
    return <Navigate to="/login?suspended=1" replace />;
  }

  if (state === "out") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
