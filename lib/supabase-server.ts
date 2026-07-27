import { createClient } from "@supabase/supabase-js";

const fallbackSupabaseUrl = "https://ztoapsloscqxjpxmxbca.supabase.co";
const fallbackSupabaseKey = "sb_publishable_ST11At63jWdmB6QqNhIjYA_ds34-iaR";

export function getServerSupabaseClient(accessToken?: string) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? fallbackSupabaseUrl;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  const key = serviceKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fallbackSupabaseKey;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: accessToken && !serviceKey ? {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    } : undefined
  });
}
