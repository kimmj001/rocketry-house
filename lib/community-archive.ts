"use client";

import type { CommunityComment, CommunityPost } from "@/lib/community-data";
import { loadPersistentRecords, PUBLIC_COMMUNITY_OWNER_KEY, savePersistentRecord } from "@/lib/cloud-persistence";

const DB_NAME = "rocketry-house-community";
const DB_VERSION = 1;
const POSTS_STORE = "posts";
const COMMENTS_STORE = "comments";
const LOCAL_POSTS_KEY = "rocketry-house-community-posts";
const COMMENT_KEY_PREFIX = "rocketry-house-community-comments:";
const ARCHIVE_OPTIONS = { ownerKey: PUBLIC_COMMUNITY_OWNER_KEY };

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function openCommunityDb() {
  return new Promise<IDBDatabase | null>((resolve) => {
    if (!canUseBrowserStorage() || !("indexedDB" in window)) {
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(POSTS_STORE)) db.createObjectStore(POSTS_STORE, { keyPath: "slug" });
      if (!db.objectStoreNames.contains(COMMENTS_STORE)) db.createObjectStore(COMMENTS_STORE, { keyPath: "slug" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function writeIdb<T extends { slug: string }>(storeName: string, value: T) {
  const db = await openCommunityDb();
  if (!db) return false;

  return new Promise<boolean>((resolve) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => {
      db.close();
      resolve(true);
    };
    transaction.onerror = () => {
      db.close();
      resolve(false);
    };
  });
}

async function readAllIdb<T>(storeName: string) {
  const db = await openCommunityDb();
  if (!db) return [] as T[];

  return new Promise<T[]>((resolve) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as T[]);
    request.onerror = () => resolve([]);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}

function safeReadLocalPosts() {
  if (!canUseBrowserStorage()) return [] as CommunityPost[];
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_POSTS_KEY) ?? "[]") as CommunityPost[];
  } catch {
    return [];
  }
}

function safeWriteLocalPosts(posts: CommunityPost[]) {
  if (!canUseBrowserStorage()) return false;
  try {
    window.localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(posts));
    return true;
  } catch {
    const textOnly = posts.map((post) => ({ ...post, images: [] }));
    try {
      window.localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(textOnly));
    } catch {
      return false;
    }
    return false;
  }
}

function safeReadLocalComments(slug: string) {
  if (!canUseBrowserStorage()) return [] as CommunityComment[];
  try {
    return JSON.parse(window.localStorage.getItem(`${COMMENT_KEY_PREFIX}${slug}`) ?? "[]") as CommunityComment[];
  } catch {
    return [];
  }
}

function safeWriteLocalComments(slug: string, comments: CommunityComment[]) {
  if (!canUseBrowserStorage()) return false;
  try {
    window.localStorage.setItem(`${COMMENT_KEY_PREFIX}${slug}`, JSON.stringify(comments));
    return true;
  } catch {
    return false;
  }
}

function mergePosts(...groups: CommunityPost[][]) {
  const map = new Map<string, CommunityPost>();
  for (const group of groups) {
    for (const post of group) {
      if (!map.has(post.slug)) map.set(post.slug, post);
    }
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
}

export async function loadCommunityPostsArchive() {
  const localPosts = safeReadLocalPosts();
  const idbPosts = await readAllIdb<CommunityPost>(POSTS_STORE);
  const cloudRecords = await loadPersistentRecords<CommunityPost>("community_posts", ARCHIVE_OPTIONS);
  const merged = mergePosts(cloudRecords.map((record) => record.payload), idbPosts, localPosts);
  safeWriteLocalPosts(merged);
  return merged;
}

export async function saveCommunityPostArchive(post: CommunityPost, currentPosts: CommunityPost[]) {
  const next = mergePosts([post], currentPosts);
  const localOk = safeWriteLocalPosts(next);
  const idbOk = await writeIdb(POSTS_STORE, post);
  const cloud = await savePersistentRecord("community_posts", post.slug, post, ARCHIVE_OPTIONS);
  return { posts: next, localOk, idbOk, cloudOk: cloud.cloud, cloudError: cloud.error };
}

export async function loadCommunityCommentsArchive(slug: string) {
  const localComments = safeReadLocalComments(slug);
  const idbRecords = await readAllIdb<{ slug: string; comments: CommunityComment[] }>(COMMENTS_STORE);
  const idbComments = idbRecords.find((record) => record.slug === slug)?.comments ?? [];
  const cloudRecords = await loadPersistentRecords<CommunityComment[]>("community_comments", ARCHIVE_OPTIONS);
  const cloudComments = cloudRecords.find((record) => record.record_key === slug)?.payload ?? [];
  return cloudComments.length ? cloudComments : idbComments.length ? idbComments : localComments;
}

export async function saveCommunityCommentsArchive(slug: string, comments: CommunityComment[]) {
  const localOk = safeWriteLocalComments(slug, comments);
  const idbOk = await writeIdb(COMMENTS_STORE, { slug, comments });
  const cloud = await savePersistentRecord("community_comments", slug, comments, ARCHIVE_OPTIONS);
  return { localOk, idbOk, cloudOk: cloud.cloud, cloudError: cloud.error };
}
