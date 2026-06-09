"use client";

import { getSupabaseClient, isMockMode } from "@/lib/supabase";
import { AUTH_STORAGE_KEY, type AuthUser } from "@/lib/auth";

const DEVICE_KEY = "rocketry-house.device-id";

export type CloudRecord<T> = {
  id?: string;
  collection: string;
  record_key: string;
  payload: T;
  updated_at?: string;
};

type PersistenceOptions = {
  ownerKey?: string;
};

export const PUBLIC_COMMUNITY_OWNER_KEY = "public:community";

function memoryId() {
  return `device-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function getDeviceId() {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = window.crypto?.randomUUID?.() ?? memoryId();
  window.localStorage.setItem(DEVICE_KEY, created);
  return created;
}

export function getPersistenceOwnerKey() {
  if (typeof window === "undefined") return "server";
  try {
    const user = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) ?? "null") as AuthUser | null;
    if (user?.id) return `user:${user.id}`;
    if (user?.email) return `email:${user.email}`;
  } catch {
    // Fall through to a device-scoped owner key.
  }
  return `device:${getDeviceId()}`;
}

export function localCollectionKey(collection: string) {
  return `rocketry-house.cloud-cache:${getPersistenceOwnerKey()}:${collection}`;
}

function resolveOwnerKey(options?: PersistenceOptions) {
  return options?.ownerKey ?? getPersistenceOwnerKey();
}

async function resolveCloudOwnerKey(options?: PersistenceOptions, mode: "read" | "write" = "read") {
  const requestedOwner = resolveOwnerKey(options);
  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) return { ownerKey: requestedOwner, authenticated: false, publicCommunity: requestedOwner === PUBLIC_COMMUNITY_OWNER_KEY };

  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  const publicCommunity = requestedOwner === PUBLIC_COMMUNITY_OWNER_KEY;

  if (publicCommunity) {
    return {
      ownerKey: PUBLIC_COMMUNITY_OWNER_KEY,
      authenticated: Boolean(userId),
      publicCommunity
    };
  }

  if (!userId) {
    return { ownerKey: requestedOwner, authenticated: false, publicCommunity: false };
  }

  return {
    ownerKey: `user:${userId}`,
    authenticated: true,
    publicCommunity: false
  };
}

export function localCollectionKeyForOwner(collection: string, ownerKey: string) {
  return `rocketry-house.cloud-cache:${ownerKey}:${collection}`;
}

export function readLocalCollection<T>(collection: string, options?: PersistenceOptions) {
  if (typeof window === "undefined") return [] as CloudRecord<T>[];
  try {
    return JSON.parse(window.localStorage.getItem(localCollectionKeyForOwner(collection, resolveOwnerKey(options))) ?? "[]") as CloudRecord<T>[];
  } catch {
    return [];
  }
}

function writeLocalCollection<T>(collection: string, records: CloudRecord<T>[], options?: PersistenceOptions) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localCollectionKeyForOwner(collection, resolveOwnerKey(options)), JSON.stringify(records));
}

export function cachePersistentRecord<T>(collection: string, recordKey: string, payload: T, options?: PersistenceOptions) {
  const current = readLocalCollection<T>(collection, options);
  const record: CloudRecord<T> = {
    collection,
    record_key: recordKey,
    payload,
    updated_at: new Date().toISOString()
  };
  writeLocalCollection(collection, [record, ...current.filter((item) => item.record_key !== recordKey)], options);
}

export async function savePersistentRecord<T>(collection: string, recordKey: string, payload: T, options?: PersistenceOptions) {
  cachePersistentRecord(collection, recordKey, payload, options);

  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) return { cloud: false, error: null };
  const owner = await resolveCloudOwnerKey(options, "write");
  if (!owner.authenticated) {
    return { cloud: false, error: new Error("Sign in is required to archive data to Supabase.") };
  }

  const { error } = await supabase.from("user_data_records").upsert(
    {
      owner_key: owner.ownerKey,
      collection,
      record_key: recordKey,
      payload,
      updated_at: new Date().toISOString()
    },
    { onConflict: "owner_key,collection,record_key" }
  );

  return { cloud: !error, error };
}

export async function loadPersistentRecords<T>(collection: string, options?: PersistenceOptions) {
  const localRecords = readLocalCollection<T>(collection, options);
  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) return localRecords;
  const owner = await resolveCloudOwnerKey(options, "read");
  if (!owner.authenticated && !owner.publicCommunity) return localRecords;

  const { data, error } = await supabase
    .from("user_data_records")
    .select("id, collection, record_key, payload, updated_at")
    .eq("owner_key", owner.ownerKey)
    .eq("collection", collection)
    .order("updated_at", { ascending: false });

  if (error || !data) return localRecords;

  const cloudRecords = data as CloudRecord<T>[];
  const merged = [
    ...cloudRecords,
    ...localRecords.filter((local) => !cloudRecords.some((cloud) => cloud.record_key === local.record_key))
  ];
  writeLocalCollection(collection, merged, options);
  return merged;
}

export async function savePersistentSet(collection: string, recordKey: string, values: Set<string>, options?: PersistenceOptions) {
  return savePersistentRecord(collection, recordKey, Array.from(values), options);
}

export async function loadPersistentSet(collection: string, recordKey: string, options?: PersistenceOptions) {
  const records = await loadPersistentRecords<string[]>(collection, options);
  const record = records.find((item) => item.record_key === recordKey);
  return new Set(record?.payload ?? []);
}

export type PersistentFileRecord = {
  id: string;
  title: string;
  name: string;
  size: number;
  type: string;
  storagePath?: string;
  publicUrl?: string;
  uploadedAt: string;
};

function safeStorageSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "file";
}

export async function uploadPersistentFiles(title: string, files: File[]) {
  const uploadedAt = new Date().toISOString();
  const supabase = getSupabaseClient();
  const { data } = supabase && !isMockMode ? await supabase.auth.getUser() : { data: { user: null } };
  const owner = data.user?.id ? safeStorageSegment(data.user.id) : safeStorageSegment(getPersistenceOwnerKey());
  const records: PersistentFileRecord[] = [];

  for (const file of files) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storagePath = `${owner}/${id}-${safeStorageSegment(file.name)}`;
    let publicUrl: string | undefined;

    if (supabase && !isMockMode && data.user?.id) {
      const { error } = await supabase.storage.from("rocketry-house-files").upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false
      });
      if (!error) {
        const { data: signedData } = await supabase.storage.from("rocketry-house-files").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
        publicUrl = signedData?.signedUrl;
      }
    }

    records.push({
      id,
      title,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      storagePath: publicUrl ? storagePath : undefined,
      publicUrl,
      uploadedAt
    });
  }

  await savePersistentRecord("uploaded_files", `${safeStorageSegment(title)}-${Date.now()}`, records);
  return records;
}
