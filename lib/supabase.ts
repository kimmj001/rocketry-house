import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://ztoapsloscqxjpxmxbca.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_ST11At63jWdmB6QqNhIjYA_ds34-iaR";

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

export const isMockMode =
  !(process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL) ||
  !(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY);
