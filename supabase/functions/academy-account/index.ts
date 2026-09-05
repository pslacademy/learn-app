/* ──────────────────────────────────────────────────────────────────────
   PSL Academy account service

   Everything that decides who somebody is, and what they may reach, runs
   here. The GoHighLevel key lives in this function's secrets and never
   reaches a browser.

   Carried from EI Academy, with one deliberate difference: there is no
   tier. PSLA has no ladder. Phase 2 reads only the admin tag and whether
   the contact exists. Phase 3 adds community resolution, and the tag
   extraction below is already shaped for it.

   Actions:
     check     is this address enrolled, and does it already have an account
     register  create a real account for an enrolled contact
     sync      re-read a signed-in member's CRM record
   ────────────────────────────────────────────────────────────────────── */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const GHL_LOCATION_ID =
  Deno.env.get("GHL_LOCATION_ID") || "JPAvk9j6fev90MrYL2Nb";
const GHL_VERSION = Deno.env.get("GHL_VERSION") || "2021-07-28";
const GHL_BASE = "https://services.leadconnectorhq.com";

/**
 * Tags, lowercased and trimmed.
 *
 * The workflow on the registration form writes the tag as "PSLA Community"
 * while existing contacts carry it as "psla community". Both must resolve to
 * the same thing, so every comparison happens on this normalised form and
 * nothing anywhere compares a raw tag string.
 */
const normaliseTags = (raw: unknown): string[] =>
  (Array.isArray(raw) ? raw : [])
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean);

/**
 * The admin tag is "psla admin".
 *
 * Bare "admin" is deliberately NOT accepted. It is generic enough to be used
 * elsewhere in the CRM for something unrelated, and it must never quietly
 * hand somebody the run of the academy.
 */
const isAdminTag = (tags: string[]) => tags.includes("psla admin");

const titleCase = (s?: string) =>
  s
    ? s
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
    : "";

interface CrmLookup {
  found: boolean;
  contactId?: string;
  firstName?: string;
  lastName?: string;
  /** Normalised. Phase 3 maps these onto communities. */
  tags?: string[];
  isAdmin?: boolean;
}

const fromContact = (contact: Record<string, unknown>): CrmLookup => {
  const tags = normaliseTags(contact.tags);
  return {
    found: true,
    contactId: String(contact.id),
    firstName: titleCase(contact.firstName as string | undefined),
    lastName: titleCase(contact.lastName as string | undefined),
    tags,
    isAdmin: isAdminTag(tags),
  };
};

/**
 * Find a contact by email.
 *
 * Throws when the CRM cannot be asked, which is different from answering
 * that there is no such contact. Nothing that costs a member access may
 * rest on a failed call.
 */
async function lookupContact(
  email: string,
  crmApiKey: string,
): Promise<CrmLookup> {
  const url =
    `${GHL_BASE}/contacts/?locationId=${encodeURIComponent(GHL_LOCATION_ID)}` +
    `&query=${encodeURIComponent(email)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${crmApiKey}`, Version: GHL_VERSION },
  });

  if (!res.ok) {
    console.error("CRM lookup failed:", res.status, await res.text());
    throw new Error(`CRM lookup failed with ${res.status}`);
  }

  const contacts = (await res.json())?.contacts ?? [];

  // query is a fuzzy search, so confirm the address actually matches.
  const contact = contacts.find(
    (c: { email?: string }) =>
      (c.email ?? "").toLowerCase() === email.toLowerCase(),
  );

  return contact ? fromContact(contact) : { found: false };
}

/**
 * GoHighLevel creates a contact immediately but its search index takes a few
 * seconds to catch up. Somebody who registers on the form and reaches
 * /welcome straight away would otherwise be told they are not enrolled
 * seconds after enrolling.
 */
async function lookupContactWithRetry(
  email: string,
  crmApiKey: string,
  attempts = 3,
): Promise<CrmLookup> {
  let last: CrmLookup = { found: false };
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000));
    last = await lookupContact(email, crmApiKey);
    if (last.found) return last;
  }
  return last;
}

/**
 * Read a contact by its id.
 *
 * A direct GET rather than a search, which matters twice over. The search
 * index lags behind writes, so an email search can answer "no such contact"
 * about a contact that plainly exists. And the search matches on the
 * contact's current primary email, so a member whose address is changed in
 * the CRM stops matching their own record. The contact id is recorded at
 * registration and does not move.
 *
 * Returns null, distinct from a "not found" answer, when the CRM cannot be
 * asked at all.
 */
async function lookupContactById(
  contactId: string,
  crmApiKey: string,
): Promise<CrmLookup | null> {
  const res = await fetch(
    `${GHL_BASE}/contacts/${encodeURIComponent(contactId)}`,
    { headers: { Authorization: `Bearer ${crmApiKey}`, Version: GHL_VERSION } },
  );

  // A genuine "this contact is gone". The only answer that may cost access.
  if (res.status === 404) return { found: false };

  if (!res.ok) {
    const detail = await res.text();

    // GoHighLevel answers a deleted contact with 400 and "Contact not found",
    // not 404. Matched on the message as well as the status, so an ordinary
    // bad request is still treated as unanswerable.
    if (res.status === 400 && /not found/i.test(detail)) {
      console.warn(`Contact ${contactId} no longer exists in the CRM`);
      return { found: false };
    }

    console.error("CRM lookup by id failed:", res.status, detail);
    return null;
  }

  const contact = (await res.json())?.contact;
  if (!contact?.id) return { found: false };

  // A contact moved to another location is not a member of this academy,
  // whatever its id once meant here.
  if (contact.locationId && contact.locationId !== GHL_LOCATION_ID) {
    console.warn(`Contact ${contactId} now belongs to another location`);
    return { found: false };
  }

  return fromContact(contact);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const crmApiKey = Deno.env.get("CRM_API_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error("Supabase environment variables missing");
    return json({ error: "Service is misconfigured" }, 500);
  }

  if (!crmApiKey) {
    console.error("CRM_API_KEY is not set on this project");
    return json(
      {
        error:
          "The academy cannot verify enrolments right now. Please contact support.",
        detail: "CRM_API_KEY missing",
      },
      503,
    );
  }

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const payload = await req.json();
    const action = payload?.action;

    /* ---- Does this address have an enrolment, and an account? ---------
       Answers the /welcome screen. Deliberately reports both, so somebody
       who already has an account is sent to sign in rather than being told
       something unhelpful after typing a password.                       */
    if (action === "check") {
      const email = String(payload.email ?? "").trim().toLowerCase();
      if (!email) return json({ error: "Email is required." }, 400);

      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      const hasAccount = Boolean(existing);

      try {
        const crm = await lookupContact(email, crmApiKey);
        return json({
          enrolled: crm.found,
          hasAccount,
          firstName: crm.firstName ?? "",
          lastName: crm.lastName ?? "",
        });
      } catch (_) {
        // The account state is still useful even if the CRM is unreachable.
        // enrolled: null means "could not ask", not "no".
        return json({ enrolled: null, hasAccount, firstName: "", lastName: "" });
      }
    }

    /* ---- Create a real account ----------------------------------------
       Registration itself happens on the GoHighLevel form on the website,
       which creates the contact and applies the community tag. This only
       ever verifies that the contact exists, then creates the account.
       Nothing about entitlement is taken from the browser.               */
    if (action === "register") {
      const email = String(payload.email ?? "").trim().toLowerCase();
      const password = String(payload.password ?? "");

      if (!email || !password) {
        return json({ error: "Email and password are required." }, 400);
      }
      if (password.length < 8) {
        return json(
          { error: "Please choose a password of at least 8 characters." },
          400,
        );
      }

      let crm: CrmLookup;
      try {
        crm = await lookupContactWithRetry(email, crmApiKey);
      } catch (_) {
        return json(
          {
            error:
              "We could not reach our records just now. Please try again in a moment.",
          },
          502,
        );
      }

      if (!crm.found) {
        return json(
          {
            error:
              "We could not find a registration for that email address. Please join the community first, or use the address you registered with.",
            code: "not_enrolled",
          },
          403,
        );
      }

      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          // Created already confirmed, so no confirmation email is sent.
          // The contact was verified against the CRM a moment ago, which is
          // a stronger check than an email round trip.
          email_confirm: true,
          user_metadata: {
            first_name: crm.firstName ?? payload.firstName ?? "",
            last_name: crm.lastName ?? payload.lastName ?? "",
          },
        });

      if (createError) {
        const already = /already|registered|exists/i.test(
          createError.message ?? "",
        );
        if (already) {
          return json(
            {
              error:
                "An account already exists for that email address. Please sign in instead, or reset your password.",
              code: "already_registered",
            },
            409,
          );
        }
        console.error("createUser failed:", createError);
        return json({ error: "Could not create the account." }, 500);
      }

      const userId = created.user?.id;
      if (!userId) return json({ error: "Could not create the account." }, 500);

      const { error: profileError } = await admin.from("profiles").insert({
        id: userId,
        email,
        first_name: crm.firstName ?? payload.firstName ?? "",
        last_name: crm.lastName ?? payload.lastName ?? "",
        is_admin: crm.isAdmin ?? false,
        crm_contact_id: crm.contactId,
        communities_synced_at: new Date().toISOString(),
      });

      if (profileError) {
        // Never leave an auth user with no profile behind.
        console.error("profile insert failed, rolling back user:", profileError);
        await admin.auth.admin.deleteUser(userId);
        return json({ error: "Could not create the account." }, 500);
      }

      console.log(`Account created for ${email}, admin: ${crm.isAdmin}`);
      return json({ success: true, isAdmin: crm.isAdmin ?? false });
    }

    /* ---- Re-read a signed-in member's CRM record ----------------------
       Identity comes from the caller's own access token, never from the
       request body, so nobody can ask about somebody else.

       Phase 3 extends this to write member_communities. Today it maintains
       the admin flag, the name, and is_active.                           */
    if (action === "sync") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) return json({ error: "Not signed in." }, 401);

      const { data: userData, error: userError } =
        await admin.auth.getUser(token);
      const userId = userData?.user?.id;
      if (userError || !userId) return json({ error: "Not signed in." }, 401);

      const { data: profile } = await admin
        .from("profiles")
        .select("crm_contact_id, email, is_admin, is_active")
        .eq("id", userId)
        .maybeSingle();

      if (!profile) return json({ error: "No profile." }, 404);

      /*
        Ask by contact id where we have one, and fall back to the address
        only when we do not. A null answer means the CRM could not be
        reached, and nothing changes: a member is never demoted, deactivated
        or stripped of anything on a failed call. That rule is the reason
        this is written as three distinct outcomes rather than a boolean.
      */
      let crm: CrmLookup | null = null;

      if (profile.crm_contact_id) {
        crm = await lookupContactById(profile.crm_contact_id, crmApiKey);
      } else {
        try {
          crm = await lookupContact(profile.email, crmApiKey);
        } catch (_) {
          crm = null;
        }
      }

      if (crm === null) {
        console.warn(`CRM unreachable for ${profile.email}, nothing changed`);
        return json({ success: true, changed: false, reachable: false });
      }

      if (!crm.found) {
        // A definite answer that the contact is gone. This is the only path
        // that may cost somebody their access.
        await admin
          .from("profiles")
          .update({
            is_active: false,
            communities_synced_at: new Date().toISOString(),
          })
          .eq("id", userId);

        console.log(`Contact gone for ${profile.email}, marked inactive`);
        return json({ success: true, changed: true, isActive: false });
      }

      const patch: Record<string, unknown> = {
        is_admin: crm.isAdmin ?? false,
        is_active: true,
        crm_contact_id: crm.contactId,
        communities_synced_at: new Date().toISOString(),
      };
      if (crm.firstName) patch.first_name = crm.firstName;
      if (crm.lastName) patch.last_name = crm.lastName;

      const { error: updateError } = await admin
        .from("profiles")
        .update(patch)
        .eq("id", userId);

      if (updateError) {
        console.error("profile update failed:", updateError);
        return json({ error: "Could not update the profile." }, 500);
      }

      return json({
        success: true,
        changed: true,
        isAdmin: crm.isAdmin ?? false,
        isActive: true,
      });
    }

    /* ---- Save the member's own details and preferences ----------------
       Identity comes from the caller's own access token. Only the columns
       listed here are touched, so nothing a member sends can reach
       is_admin, is_active or crm_contact_id even by accident.            */
    if (action === "update-profile") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) return json({ error: "Not signed in." }, 401);

      const { data: userData, error: userError } =
        await admin.auth.getUser(token);
      const user = userData?.user;
      if (userError || !user) return json({ error: "Not signed in." }, 401);

      const p = payload.profile ?? {};

      /*
        Save our own record first, and do not make it conditional on the CRM.
        An earlier version of this in EI Academy lost the member's edits
        whenever GoHighLevel was slow, which is the wrong way round: their
        own academy is the system of record for their preferences.
      */
      const patch: Record<string, unknown> = {};
      if (p.firstName !== undefined) patch.first_name = p.firstName || null;
      if (p.lastName !== undefined) patch.last_name = p.lastName || null;
      if (p.title !== undefined) patch.title = p.title || null;
      if (p.location !== undefined) patch.location = p.location || null;
      if (p.bio !== undefined) patch.bio = p.bio || null;
      if (p.timezone !== undefined) patch.timezone = p.timezone || null;
      if (p.avatarUrl !== undefined) patch.avatar_url = p.avatarUrl || null;
      if (p.allowMessaging !== undefined) {
        patch.allow_messaging = Boolean(p.allowMessaging);
      }
      if (p.notifyCourseUpdates !== undefined) {
        patch.notify_course_updates = Boolean(p.notifyCourseUpdates);
      }
      if (p.notifyCommunityMentions !== undefined) {
        patch.notify_community_mentions = Boolean(p.notifyCommunityMentions);
      }
      if (p.notifyMarketing !== undefined) {
        patch.notify_marketing = Boolean(p.notifyMarketing);
      }

      if (Object.keys(patch).length > 0) {
        const { error: profileError } = await admin
          .from("profiles")
          .update(patch)
          .eq("id", user.id);

        if (profileError) {
          console.error("profile update failed:", profileError);
          return json({ error: "Could not save your profile." }, 500);
        }
      }

      // Mirror the name back to the CRM, so a member who corrects a typo in
      // the academy does not stay wrong in GoHighLevel. Preferences are not
      // pushed: they belong to the academy, not to the marketing record.
      const { data: row } = await admin
        .from("profiles")
        .select("crm_contact_id")
        .eq("id", user.id)
        .maybeSingle();

      const contactId: string | null = row?.crm_contact_id ?? null;
      if (!contactId) {
        return json({ success: true, crmSynced: false, reason: "no_contact" });
      }

      const crmPayload: Record<string, unknown> = {};
      if (p.firstName) crmPayload.firstName = p.firstName;
      if (p.lastName) crmPayload.lastName = p.lastName;

      /*
        Country and timezone are standard GoHighLevel contact fields, not
        custom ones. country expects an ISO 3166-1 alpha-2 code, which is
        exactly what the picker stores, so nothing is translated here.

        The avatar is deliberately not sent. It is an 800K data URL and the
        CRM has nowhere sensible to put it.
      */
      if (p.location) crmPayload.country = p.location;
      if (p.timezone) crmPayload.timezone = p.timezone;

      /*
        Professional Title and Professional Bio, in the Additional Information
        group of the PSLA sub-account. The same arrangement as EI Academy.

        The ids are read from secrets so that a field rebuilt in GoHighLevel
        can be pointed at without redeploying this function, with the current
        ids as the fallback.
      */
      const customFields: Array<{ id: string; value: unknown }> = [];
      const titleFieldId =
        Deno.env.get("CRM_TITLE_FIELD_ID") || "JlNwpFkmpMuJt62IHLJ1";
      const bioFieldId =
        Deno.env.get("CRM_BIO_FIELD_ID") || "efNISpd6mJRsd2o2Xf9g";

      if (p.title !== undefined) {
        customFields.push({ id: titleFieldId, value: p.title ?? "" });
      }
      if (p.bio !== undefined) {
        customFields.push({ id: bioFieldId, value: p.bio ?? "" });
      }
      if (customFields.length > 0) crmPayload.customFields = customFields;

      if (Object.keys(crmPayload).length === 0) {
        return json({ success: true, crmSynced: false, reason: "nothing_to_sync" });
      }

      try {
        const res = await fetch(
          `${GHL_BASE}/contacts/${encodeURIComponent(contactId)}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${crmApiKey}`,
              Version: GHL_VERSION,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(crmPayload),
          },
        );

        if (!res.ok) {
          // Saved here, not mirrored there. Reported rather than raised: the
          // member's own record is already correct.
          console.warn("CRM profile push failed:", res.status, await res.text());
          return json({ success: true, crmSynced: false, reason: "crm_error" });
        }
      } catch (e) {
        console.warn("CRM profile push threw:", String(e));
        return json({ success: true, crmSynced: false, reason: "crm_unreachable" });
      }

      return json({ success: true, crmSynced: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("Unhandled error:", error);
    return json({ error: "Something went wrong." }, 500);
  }
});
