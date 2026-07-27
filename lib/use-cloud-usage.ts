"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient, isMockMode } from "@/lib/supabase";
import type { LimitedUsageField, UsageCounters, UsageStatus } from "@/lib/usage-limits";

type UsageResponse = {
  usage: UsageCounters;
  statuses: Record<LimitedUsageField, UsageStatus>;
};

type ClaimResponse = UsageResponse & {
  allowed?: boolean;
  blocked?: boolean;
  prompt?: {
    title: string;
    description: string;
    primaryAction: string;
    secondaryAction: string;
    dismissAction: string;
  };
  message?: string;
  error?: string;
};

export async function getCloudUsageAuthHeaders() {
  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : null;
}

export function useCloudUsage() {
  const [usage, setUsage] = useState<UsageCounters | null>(null);
  const [statuses, setStatuses] = useState<Record<LimitedUsageField, UsageStatus> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const applyUsage = useCallback((payload: UsageResponse) => {
    setUsage(payload.usage);
    setStatuses(payload.statuses);
  }, []);

  const refreshUsage = useCallback(async () => {
    setLoading(true);
    const headers = await getCloudUsageAuthHeaders();
    if (!headers) {
      setError("Cloud sign-in is required to sync Standard plan usage.");
      setLoading(false);
      return null;
    }

    const response = await fetch("/api/usage/status", { headers, cache: "no-store" });
    const data = (await response.json()) as UsageResponse & { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Cloud usage status could not be loaded.");
      setLoading(false);
      return null;
    }

    applyUsage(data);
    setError("");
    setLoading(false);
    return data;
  }, [applyUsage]);

  const claimUsage = useCallback(async (field: LimitedUsageField) => {
    const headers = await getCloudUsageAuthHeaders();
    if (!headers) {
      const data: ClaimResponse = {
        error: "Cloud sign-in is required before using Standard plan quota.",
        usage: usage as UsageCounters,
        statuses: statuses as Record<LimitedUsageField, UsageStatus>
      };
      setError(data.error ?? "");
      return { ok: false, data, status: 401 };
    }

    const response = await fetch("/api/usage/claim", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ field })
    });
    const data = (await response.json()) as ClaimResponse;

    if (data.usage && data.statuses) applyUsage(data);
    if (!response.ok && data.error) setError(data.error);
    else setError("");

    return { ok: response.ok, data, status: response.status };
  }, [applyUsage, statuses, usage]);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  return {
    usage,
    statuses,
    loading,
    error,
    refreshUsage,
    claimUsage
  };
}
