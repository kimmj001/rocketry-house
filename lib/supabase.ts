import { createClient } from "@supabase/supabase-js";

const publicSupabaseUrl = "https://ztoapsloscqxjpxmxbca.supabase.co";
const publicSupabaseKey = "sb_publishable_ST11At63jWdmB6QqNhIjYA_ds34-iaR";

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? publicSupabaseUrl;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? publicSupabaseKey;
  return createClient(url, anonKey);
}

export const isMockMode =
  !(process.env.NEXT_PUBLIC_SUPABASE_URL ?? publicSupabaseUrl) ||
  !(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? publicSupabaseKey);
