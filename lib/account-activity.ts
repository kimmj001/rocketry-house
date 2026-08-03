"use client";

import { getSupabaseClient, isMockMode } from "@/lib/supabase";
import type { AccountActivity, AccountActivityType } from "@/lib/account-status-types";

export const ACCOUNT_ACTIVITY_COLLECTION = "account_activity";

type ActivityInput = {
  type: AccountActivityType;
  title: string;
  detail?: string;
  subjectId?: string;
  subjectUrl?: string;
  collection?: string;
  occurredAt?: string;
  idempotencyKey?: string;
};

const LOCAL_ACTIVITY_PREFIX = "rocketry-house.account-activity:";

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "") || "activity";
}

function eventId(input: ActivityInput) {
  if (input.idempotencyKey) return `activity-${safeSegment(input.idempotencyKey)}`;
  if (globalThis.crypto?.randomUUID) return `activity-${globalThis.crypto.randomUUID()}`;
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function storeLocalActivity(accountId: string, activity: AccountActivity) {
  try {
    const key = `${LOCAL_ACTIVITY_PREFIX}${accountId}`;
    const current = JSON.parse(localStorage.getItem(key) ?? "[]") as AccountActivity[];
    const next = [activity, ...current.filter((item) => item.id !== activity.id)].slice(0, 500);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Cloud persistence remains the source of truth when browser storage is unavailable.
  }
}

export async function recordAccountActivity(input: ActivityInput) {
  const supabase = getSupabaseClient();
  if (!supabase || isMockMode) return { cloud: false, error: null };

  const { data, error: userError } = await supabase.auth.getUser();
  const user = data.user;
  if (userError || !user) return { cloud: false, error: userError ?? new Error("Sign in is required to record account activity.") };

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const id = eventId(input);
  const activity: AccountActivity & { accountId: string; accountEmail?: string } = {
    id,
    type: input.type,
    title: input.title,
    detail: input.detail,
    occurredAt,
    subjectId: input.subjectId,
    subjectUrl: input.subjectUrl,
    collection: input.collection,
    accountId: user.id,
    accountEmail: user.email?.toLowerCase()
  };

  storeLocalActivity(user.id, activity);

  const query = supabase.from("user_data_records");
  const record = {
    owner_key: `user:${user.id}`,
    collection: ACCOUNT_ACTIVITY_COLLECTION,
    record_key: id,
    payload: activity,
    updated_at: occurredAt
  };
  const { error } = input.idempotencyKey
    ? await query.upsert(record, { onConflict: "owner_key,collection,record_key" })
    : await query.insert(record);

  return { cloud: !error, error, activity };
}

type PersistentActivityInput = {
  collection: string;
  recordKey: string;
  payload: unknown;
};

export function activityForPersistentRecord({ collection, recordKey, payload }: PersistentActivityInput): ActivityInput | null {
  const value = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const title = typeof value.title === "string" ? value.title : typeof value.name === "string" ? value.name : recordKey;

  if (collection === "projects") {
    return { type: "project_published", title: `Published project: ${title}`, subjectId: recordKey, subjectUrl: `/projects/${recordKey}`, collection, idempotencyKey: `project-published:${recordKey}` };
  }
  if (collection === "rocket_projects") {
    return { type: "project_created", title: `Created project: ${title}`, subjectId: recordKey, subjectUrl: `/projects/${recordKey}`, collection, idempotencyKey: `project-created:${recordKey}` };
  }
  if (collection === "saved_motors") {
    return { type: "motor_saved", title: `Saved motor: ${title}`, subjectId: recordKey, subjectUrl: `/motors/${recordKey}`, collection, idempotencyKey: `motor-saved:${recordKey}` };
  }
  if (collection === "community_posts") {
    return { type: "community_post_published", title: `Published community post: ${title}`, subjectId: recordKey, subjectUrl: `/community/${recordKey}`, collection, idempotencyKey: `community-post:${recordKey}` };
  }
  if (collection === "community_comments" && Array.isArray(payload)) {
    const latest = payload[0] && typeof payload[0] === "object" ? payload[0] as Record<string, unknown> : {};
    const commentId = typeof latest.id === "string" ? latest.id : `${recordKey}-${payload.length}`;
    return { type: "community_comment_created", title: "Added a community comment", subjectId: recordKey, subjectUrl: `/community/${recordKey}`, collection, idempotencyKey: `community-comment:${commentId}` };
  }
  if (collection === "uploaded_files") {
    const count = Array.isArray(payload) ? payload.length : 1;
    return { type: "file_uploaded", title: `Uploaded ${count} file${count === 1 ? "" : "s"}`, subjectId: recordKey, collection, idempotencyKey: `files-uploaded:${recordKey}` };
  }
  if (["upload-drafts", "profiles", "rocket_builder_current", "usage_counters", "community_state", ACCOUNT_ACTIVITY_COLLECTION].includes(collection)) return null;

  const friendlyCollection = collection.replace(/[_-]+/g, " ");
  return { type: "record_created", title: `Created ${friendlyCollection}: ${title}`, subjectId: recordKey, collection, idempotencyKey: `record:${collection}:${recordKey}` };
}

export async function recordPersistentActivity(input: PersistentActivityInput) {
  const activity = activityForPersistentRecord(input);
  return activity ? recordAccountActivity(activity) : { cloud: false, error: null };
}

export async function recordSetChanges(collection: string, recordKey: string, previous: Set<string>, next: Set<string>) {
  const additions = Array.from(next).filter((value) => !previous.has(value));
  const removals = Array.from(previous).filter((value) => !next.has(value));
  const isLikes = /liked/i.test(recordKey);
  const isBookmarks = /bookmarked/i.test(recordKey);

  await Promise.all([
    ...additions.map((subjectId) => recordAccountActivity({
      type: isLikes ? "like_created" : isBookmarks ? "bookmark_created" : "record_updated",
      title: isLikes ? "Liked a community post" : isBookmarks ? "Bookmarked a community post" : "Updated community state",
      subjectId,
      subjectUrl: `/community/${subjectId}`,
      collection
    })),
    ...removals.map((subjectId) => recordAccountActivity({
      type: isLikes ? "like_removed" : isBookmarks ? "bookmark_removed" : "record_updated",
      title: isLikes ? "Removed a community like" : isBookmarks ? "Removed a community bookmark" : "Updated community state",
      subjectId,
      subjectUrl: `/community/${subjectId}`,
      collection
    }))
  ]);
}

export function readLocalAccountActivities(accountId: string) {
  try {
    return JSON.parse(localStorage.getItem(`${LOCAL_ACTIVITY_PREFIX}${accountId}`) ?? "[]") as AccountActivity[];
  } catch {
    return [];
  }
}
