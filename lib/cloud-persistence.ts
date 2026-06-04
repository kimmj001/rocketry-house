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

export function readLocalCollection<T>(collection: string) {
  if (typeof window === "undefined") return [] as CloudRecord<T>[];
  try {
    return JSON.parse(window.localStorage.getItem(localCollectionKey(collection)) ?? "[]") as CloudRecord<T>[];
  } catch {
    return [];
  }
}

function writeLocalCollection<T>(collection: string, records: CloudRecord<T>[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localCollectionKey(collection), JSON.stringify(records));
}

export function cachePersistentRecord<T>(collection: string, recordKey: string, payload: T) {
  const current = readLocalCollection<T>(collection);
  const record: CloudRecord<T> = {
    collection,
    record_key: recordKey,
    payload,
    updated_at: new Date().toISOString()
  };
  writeLocalCollection(collection, [record, ...current.filter((item) => item.record_key !== recordKey)]);
}

export async function savePersistentRecord<T>(collection: string, recordKey: string, payload: T) {
  cachePersistentRecord(collection, recordKey, payload);

  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) return { cloud: false, error: null };

  const { error } = await supabase.from("user_data_records").upsert(
    {
      owner_key: getPersistenceOwnerKey(),
      collection,
      record_key: recordKey,
      payload,
      updated_at: new Date().toISOString()
    },
    { onConflict: "owner_key,collection,record_key" }
  );

  return { cloud: !error, error };
}

export async function loadPersistentRecords<T>(collection: string) {
  const localRecords = readLocalCollection<T>(collection);
  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) return localRecords;

  const { data, error } = await supabase
    .from("user_data_records")
    .select("id, collection, record_key, payload, updated_at")
    .eq("owner_key", getPersistenceOwnerKey())
    .eq("collection", collection)
    .order("updated_at", { ascending: false });

  if (error || !data) return localRecords;

  const cloudRecords = data as CloudRecord<T>[];
  const merged = [
    ...cloudRecords,
    ...localRecords.filter((local) => !cloudRecords.some((cloud) => cloud.record_key === local.record_key))
  ];
  writeLocalCollection(collection, merged);
  return merged;
}

export async function savePersistentSet(collection: string, recordKey: string, values: Set<string>) {
  return savePersistentRecord(collection, recordKey, Array.from(values));
}

export async function loadPersistentSet(collection: string, recordKey: string) {
  const records = await loadPersistentRecords<string[]>(collection);
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
  const owner = safeStorageSegment(getPersistenceOwnerKey());
  const supabase = getSupabaseClient();
  const records: PersistentFileRecord[] = [];

  for (const file of files) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storagePath = `${owner}/${id}-${safeStorageSegment(file.name)}`;
    let publicUrl: string | undefined;

    if (supabase && !isMockMode) {
      const { error } = await supabase.storage.from("rocketry-house-files").upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false
      });
      if (!error) {
        const { data } = supabase.storage.from("rocketry-house-files").getPublicUrl(storagePath);
        publicUrl = data.publicUrl;
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
