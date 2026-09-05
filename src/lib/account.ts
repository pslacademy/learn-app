// src/lib/account.ts
//
// Real accounts. Everything that decides entitlement happens server side.
// This file only asks and reports.
//
// There is no tier here, and there must never be one. PSLA has no ladder.
// The admin flag and is_active come from the profiles table, which a member
// can read but cannot write, and which is populated from GoHighLevel tags by
// the academy-account edge function. Community membership arrives in phase 3
// and will follow exactly the same rule.

import { supabase } from "./supabase";

const FN = "academy-account";

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  location: string | null;
  bio: string | null;
  avatar_url: string | null;
  allow_messaging: boolean;
  notify_course_updates: boolean;
  notify_community_mentions: boolean;
  notify_marketing: boolean;
  is_admin: boolean;
  is_active: boolean;
  crm_contact_id: string | null;
  /** When the CRM was last read. Drives the re-read on open. */
  communities_synced_at: string | null;
}

export interface AccountResult {
  ok: boolean;
  error?: string;
  code?: string;
}

export interface AccountCheck {
  /** true registered, false not found, null the CRM could not be reached */
  enrolled: boolean | null;
  /** already has an account and should be signing in, not registering */
  hasAccount: boolean;
  firstName: string;
  lastName: string;
}

/**
 * What should the welcome page show this person?
 *
 * The name comes back from the CRM rather than from the URL, so the prefill
 * is right whatever the link happened to carry, and nothing in the address
 * bar is ever treated as identity.
 */
export const checkAccount = async (email: string): Promise<AccountCheck> => {
  const { data, error } = await supabase.functions.invoke(FN, {
    body: { action: "check", email },
  });

  if (error || !data) {
    return { enrolled: null, hasAccount: false, firstName: "", lastName: "" };
  }

  return {
    enrolled: data.enrolled ?? null,
    hasAccount: Boolean(data.hasAccount),
    firstName: data.firstName ?? "",
    lastName: data.lastName ?? "",
  };
};

/**
 * Create a real account and sign the member in.
 *
 * The server confirms they exist in the CRM, creates the account, and records
 * their contact id. Nothing about entitlement is taken from the browser.
 */
export const createAccount = async (
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
): Promise<AccountResult> => {
  const { data, error } = await supabase.functions.invoke(FN, {
    body: { action: "register", email, password, firstName, lastName },
  });

  // A non-2xx from the function arrives as an error, with the useful message
  // in the response body rather than in error.message.
  if (error) {
    let message = "We could not create your account. Please try again.";
    let code: string | undefined;
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) message = body.error;
      if (body?.code) code = body.code;
    } catch (_) {
      /* fall back to the generic message */
    }
    return { ok: false, error: message, code };
  }

  if (!data?.success) {
    return {
      ok: false,
      error: data?.error ?? "We could not create your account.",
    };
  }

  // Created, so sign them straight in. This is what gives them a real session
  // rather than a flag in their own browser.
  const signIn = await signInWithPassword(email, password);
  if (!signIn.ok) {
    return {
      ok: false,
      error:
        "Your account was created, but signing in failed. Please try signing in.",
    };
  }

  return { ok: true };
};

export const signInWithPassword = async (
  email: string,
  password: string,
): Promise<AccountResult> => {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    const wrong = /invalid login credentials/i.test(error.message);
    return {
      ok: false,
      error: wrong
        ? "That email address and password do not match. If you have not set a password yet, please set one first."
        : error.message,
    };
  }

  return { ok: true };
};

export const signOut = async () => {
  await supabase.auth.signOut();
};

/**
 * Re-read this member's CRM record.
 *
 * Returns quietly on failure. A CRM that cannot be reached must never change
 * anything, which is enforced server side; this only avoids making noise
 * about it in the interface.
 */
export const syncFromCrm = async (): Promise<void> => {
  try {
    await supabase.functions.invoke(FN, { body: { action: "sync" } });
  } catch (_) {
    /* a failed sync changes nothing, by design */
  }
};

export const getProfile = async (): Promise<Profile | null> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Could not read the profile:", error.message);
    return null;
  }

  return (data as Profile) ?? null;
};

/**
 * Send a password reset email.
 *
 * redirectTo must be on the allow-list in Supabase → Authentication → URL
 * Configuration. Anything outside it is silently ignored and the member gets
 * a link to the wrong place with no error anywhere.
 */
export const sendPasswordReset = async (email: string) =>
  supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });

/**
 * Change your own password from inside the app.
 *
 * The current password is verified by actually signing in with it, rather
 * than being collected and ignored. That serves two purposes: somebody at a
 * borrowed laptop cannot change the password without knowing the old one,
 * and the fresh sign-in satisfies Supabase's rule that refuses an update
 * when the session is not recent.
 */
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<AccountResult> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const email = sessionData?.session?.user?.email;
  if (!email) {
    return { ok: false, error: "You are not signed in. Please sign in again." };
  }

  const verify = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verify.error) {
    return {
      ok: false,
      error: "Your current password is not correct.",
      code: "wrong_current_password",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
};
