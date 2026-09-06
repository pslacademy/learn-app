import { createClient } from "@supabase/supabase-js";

/**
 * The PSL Academy Supabase project.
 *
 * The key below is the publishable anon key. It is designed to be public and
 * is safe in the browser: it grants nothing on its own, because every table
 * has row level security and every entitlement decision is made in the
 * database.
 *
 * A service_role key must never appear in this file, or in any VITE_
 * variable, because Vite bakes those into the built JavaScript.
 */
const SUPABASE_URL = "https://ldaqllveexpmuvywptda.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkYXFsbHZlZXhwbXV2eXdwdGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0OTcwODQsImV4cCI6MjEwNDA3MzA4NH0.ZWTWQJdUNN64V38r7UhiE9uDO8cZg-yEe7xXL7iE-q0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
