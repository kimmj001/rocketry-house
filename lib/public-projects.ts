import { archivedProjectToRocketProject } from "@/lib/project-archive";
import { isInternalTestProject } from "@/lib/internal-test-data";
import { PUBLIC_PROJECTS_OWNER_KEY } from "@/lib/public-owner-keys";
import { getSupabaseClient, isMockMode } from "@/lib/supabase";
import type { RocketProject } from "@/lib/types";

type PublicProjectRecord = Parameters<typeof archivedProjectToRocketProject>[0];

export async function loadPublicProjectArchive(limit?: number): Promise<{ projects: RocketProject[]; error: string | null }> {
  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) return { projects: [], error: null };

  let query = supabase
    .from("user_data_records")
    .select("collection, record_key, payload, updated_at")
    .eq("owner_key", PUBLIC_PROJECTS_OWNER_KEY)
    .eq("collection", "projects")
    .order("updated_at", { ascending: false });

  if (limit) query = query.limit(Math.max(limit * 12, 60));

  const { data, error } = await query;
  if (error || !data) return { projects: [], error: error?.message ?? "Could not load public projects." };

  return {
    projects: (data as PublicProjectRecord[])
      .map((record, index) => archivedProjectToRocketProject(record, index))
      .filter((project) => !isInternalTestProject(project))
      .slice(0, limit),
    error: null
  };
}

export async function loadPublicProjectBySlug(slug: string): Promise<RocketProject | undefined> {
  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) return undefined;

  const { data, error } = await supabase
    .from("user_data_records")
    .select("collection, record_key, payload, updated_at")
    .eq("owner_key", PUBLIC_PROJECTS_OWNER_KEY)
    .eq("collection", "projects")
    .eq("record_key", slug)
    .maybeSingle();

  if (error || !data) return undefined;
  const project = archivedProjectToRocketProject(data as PublicProjectRecord);
  return isInternalTestProject(project) ? undefined : project;
}
