"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bookmark,
  ChevronRight,
  Eye,
  Flag,
  ImagePlus,
  MessageSquare,
  PenLine,
  Search,
  ThumbsUp,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommunityPost,
  communityTopics,
  getCommunityAuthorFromAuth,
  guestCommunityUser
} from "@/lib/community-data";
import { readMockUser, restoreAuthUserFromCloud, type AuthUser } from "@/lib/auth";
import { loadPersistentSet, savePersistentSet } from "@/lib/cloud-persistence";
import { loadCommunityPostsArchive, saveCommunityPostArchive } from "@/lib/community-archive";

const LOCAL_POSTS_KEY = "rocketry-house-community-posts";
const LIKED_POSTS_KEY = "rocketry-house-community-liked-posts";
const BOOKMARKED_POSTS_KEY = "rocketry-house-community-bookmarked-posts";
const REPORTED_POSTS_KEY = "rocketry-house-community-reported-posts";
const memoryStore = new Map<string, string>();

type SortMode = "Newest" | "Best" | "Most viewed";

function getStoredItem(key: string) {
  if (typeof window === "undefined" || !window.localStorage) return memoryStore.get(key) ?? null;
  return window.localStorage.getItem(key);
}

function setStoredItem(key: string, value: string) {
  memoryStore.set(key, value);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // IndexedDB and cloud archives still protect posts when localStorage is full.
    }
  }
}

function readStoredPosts() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(getStoredItem(LOCAL_POSTS_KEY) ?? "[]") as CommunityPost[];
  } catch {
    return [];
  }
}

function readStoredSet(key: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    return new Set(JSON.parse(getStoredItem(key) ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
}

function storeSet(key: string, value: Set<string>) {
  setStoredItem(key, JSON.stringify(Array.from(value)));
  void savePersistentSet("community_state", key, value);
}

function slugify(value: string) {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${base || "community-post"}-${Date.now().toString(36)}`;
}

function viewNumber(value: string) {
  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned.endsWith("k")) return Number.parseFloat(cleaned) * 1000;
  return Number.parseFloat(cleaned) || 0;
}

function formatMetric(value: number | string) {
  const number = typeof value === "number" ? value : viewNumber(value);
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(number);
}

function postScore(post: CommunityPost) {
  return viewNumber(post.views) * 0.08 + post.likes * 4 + post.comments * 8;
}

function postFreshness(post: CommunityPost) {
  if (!post.createdAt) return 0;
  return new Date(post.createdAt).getTime();
}

function compressImageDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image read failed."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Image decode failed."));
      image.onload = () => {
        const maxEdge = 1400;
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas unavailable."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function AuthorAvatar({ post }: { post: CommunityPost }) {
  const initial = post.author.name.trim().charAt(0).toUpperCase() || "R";

  if (post.author.avatarUrl) {
    return (
      <img
        src={post.author.avatarUrl}
        alt=""
        className="h-11 w-11 rounded-full border border-slate-200 object-cover"
      />
    );
  }

  return (
    <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-sky-100 to-violet-200 text-sm font-bold text-slate-900">
      {initial}
    </div>
  );
}

function PostMetrics({ post }: { post: CommunityPost }) {
  return (
    <div className="flex items-center gap-4 text-sm text-slate-400">
      <span className="inline-flex items-center gap-1">
        <Eye className="h-4 w-4" />
        {formatMetric(post.views)}
      </span>
      <span className="inline-flex items-center gap-1">
        <ThumbsUp className="h-4 w-4" />
        {formatMetric(post.likes)}
      </span>
      <span className="inline-flex items-center gap-1">
        <MessageSquare className="h-4 w-4" />
        {formatMetric(post.comments)}
      </span>
    </div>
  );
}

function CompactPostRow({ post }: { post: CommunityPost }) {
  return (
    <Link href={`/community/${post.slug}`} className="block border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50">
      <div className="line-clamp-1 text-sm font-semibold text-slate-800">{post.title}</div>
      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-400">
        <span>{post.topic}</span>
        <PostMetrics post={post} />
      </div>
    </Link>
  );
}

function FeedPost({
  post,
  liked,
  bookmarked,
  reported,
  onLike,
  onBookmark,
  onReport
}: {
  post: CommunityPost;
  liked: boolean;
  bookmarked: boolean;
  reported: boolean;
  onLike: () => void;
  onBookmark: () => void;
  onReport: () => void;
}) {
  return (
    <article className="border-b border-slate-100 bg-white px-5 py-5 last:border-b-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-600">{post.topic}</span>
        <div className="flex items-center gap-1 text-slate-400">
          <button
            type="button"
            onClick={onBookmark}
            className={`rounded-full p-1.5 hover:bg-slate-100 ${bookmarked ? "text-orange-600" : ""}`}
            aria-label="Save post"
          >
            <Bookmark className="h-4 w-4" fill={bookmarked ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={onReport}
            className={`rounded-full p-1.5 hover:bg-slate-100 ${reported ? "text-rose-600" : ""}`}
            aria-label="Report post"
          >
            <Flag className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Link href={`/community/${post.slug}`} className="group block">
        <h3 className="text-xl font-bold leading-snug text-slate-950 group-hover:text-orange-600">{post.title}</h3>
        <p className="mt-2 line-clamp-2 text-base leading-7 text-slate-500">{post.preview}</p>
      </Link>

      {post.images?.length ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {post.images.slice(0, 2).map((image, index) => (
            <figure key={`${image}-${index}`} className="relative aspect-video overflow-hidden rounded-sm border border-slate-200 bg-slate-50">
              <img src={image} alt="" className="absolute inset-0 h-full w-full object-contain" />
            </figure>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <AuthorAvatar post={post} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-950">{post.author.name}</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{post.author.badge}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{post.author.profileType}</span>
          </div>
          <div className="line-clamp-1 text-sm text-slate-500">
            {post.author.role} / {post.author.team} / {post.time}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <PostMetrics post={post} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLike}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold ${
              liked ? "border-orange-200 bg-orange-50 text-orange-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <ThumbsUp className="h-4 w-4" />
            Like
          </button>
          <Link
            href={`/community/${post.slug}`}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            <MessageSquare className="h-4 w-4" />
            Reply
          </Link>
        </div>
      </div>
    </article>
  );
}

export function CommunityBoard() {
  const [localPosts, setLocalPosts] = useState<CommunityPost[]>([]);
  const [activeTopic, setActiveTopic] = useState<string>("All topics");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("Newest");
  const [composerOpen, setComposerOpen] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [archiveStatus, setArchiveStatus] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    body: "",
    topic: "Propulsion",
    images: [] as string[]
  });

  useEffect(() => {
    let active = true;

    setLocalPosts(readStoredPosts());
    setLiked(readStoredSet(LIKED_POSTS_KEY));
    setBookmarked(readStoredSet(BOOKMARKED_POSTS_KEY));
    setReported(readStoredSet(REPORTED_POSTS_KEY));

    async function hydrate() {
      const restored = await restoreAuthUserFromCloud();
      const nextUser = restored ?? readMockUser();
      if (!active) return;
      setUser(nextUser);

      const [cloudPosts, cloudLiked, cloudBookmarked, cloudReported] = await Promise.all([
        loadCommunityPostsArchive(),
        loadPersistentSet("community_state", LIKED_POSTS_KEY),
        loadPersistentSet("community_state", BOOKMARKED_POSTS_KEY),
        loadPersistentSet("community_state", REPORTED_POSTS_KEY)
      ]);

      if (!active) return;

      if (cloudPosts.length) {
        const merged = new Map<string, CommunityPost>();
        [...cloudPosts, ...readStoredPosts()].forEach((post) => merged.set(post.slug, post));
        const nextPosts = Array.from(merged.values()).sort((a, b) => postFreshness(b) - postFreshness(a));
        setLocalPosts(nextPosts);
        setStoredItem(LOCAL_POSTS_KEY, JSON.stringify(nextPosts));
        setArchiveStatus(`Synced ${nextPosts.length} archived community posts.`);
      }

      if (cloudLiked.size) setLiked(cloudLiked);
      if (cloudBookmarked.size) setBookmarked(cloudBookmarked);
      if (cloudReported.size) setReported(cloudReported);
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, []);

  const author = useMemo(() => getCommunityAuthorFromAuth(user), [user]);
  const isSignedIn = Boolean(user?.email);
  const posts = useMemo(() => localPosts, [localPosts]);

  const visiblePosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = posts.filter((post) => {
      const topicMatch = activeTopic === "All topics" || post.topic === activeTopic;
      const queryMatch =
        !normalizedQuery ||
        [post.title, post.preview, post.author.name, post.author.team, post.topic]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return topicMatch && queryMatch;
    });

    return filtered.sort((a, b) => {
      if (sortMode === "Best") return postScore(b) - postScore(a);
      if (sortMode === "Most viewed") return viewNumber(b.views) - viewNumber(a.views);
      return postFreshness(b) - postFreshness(a);
    });
  }, [activeTopic, posts, query, sortMode]);

  const bestPosts = useMemo(() => {
    const candidates = visiblePosts.length ? visiblePosts : posts;
    return candidates
      .filter((post) => post.best || post.likes > 20 || post.comments > 5)
      .sort((a, b) => postScore(b) - postScore(a))
      .slice(0, 3);
  }, [posts, visiblePosts]);

  const recommendedPosts = useMemo(() => {
    const candidates = visiblePosts.length ? visiblePosts : posts;
    return candidates
      .filter((post) => post.recommended || bookmarked.has(post.slug))
      .concat(candidates)
      .filter((post, index, array) => array.findIndex((item) => item.slug === post.slug) === index)
      .slice(0, 7);
  }, [bookmarked, posts, visiblePosts]);

  function toggleSet(key: string, setter: (next: Set<string>) => void, value: Set<string>, slug: string) {
    const next = new Set(value);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setter(next);
    storeSet(key, next);
  }

  async function submitPost() {
    if (!isSignedIn || !draft.title.trim() || !draft.body.trim()) return;

    const now = new Date();
    const post: CommunityPost = {
      slug: slugify(draft.title),
      topic: draft.topic,
      title: draft.title.trim(),
      preview: draft.body.trim(),
      body: draft.body
        .trim()
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
      author,
      time: "Just now",
      views: "0",
      likes: 0,
      comments: 0,
      evidenceLinks: [],
      images: draft.images,
      createdAt: now.toISOString(),
      createdLocally: true,
      commentList: []
    };

    const nextPosts = [post, ...localPosts];
    setLocalPosts(nextPosts);
    setStoredItem(LOCAL_POSTS_KEY, JSON.stringify(nextPosts));
    setDraft({ title: "", body: "", topic: "Propulsion", images: [] });
    setComposerOpen(false);
    setArchiveStatus("Saving post to the cloud archive...");

    const result = await saveCommunityPostArchive(post, nextPosts);
    setArchiveStatus(result.cloudOk ? "Post saved to the cloud archive." : "Post saved locally. Cloud sync will retry when configured.");
  }

  async function attachImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const encoded = await Promise.all(files.slice(0, 4).map((file) => compressImageDataUrl(file)));
    setDraft((current) => ({ ...current, images: [...current.images, ...encoded].slice(0, 4) }));
    event.target.value = "";
  }

  return (
    <main className="min-h-screen bg-[#f2f2f2] px-4 pb-20 pt-20 text-slate-950 sm:px-6">
      <div className="mx-auto grid max-w-[1180px] gap-6 lg:grid-cols-[280px_minmax(0,620px)_280px]">
        <aside className="space-y-5 lg:sticky lg:top-20">
          <section className="bg-white p-4 shadow-sm">
            <label className="flex items-center gap-3 rounded-sm bg-slate-50 px-4 py-3 text-slate-400">
              <Search className="h-5 w-5" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search discussions"
                className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
          </section>

          <section className="bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <UsersRound className="h-5 w-5 text-orange-500" />
              <h2 className="font-bold">My aerospace community</h2>
            </div>
            <div className="p-5">
              {isSignedIn ? (
                <div className="flex items-center gap-3">
                  <AuthorAvatar
                    post={{
                      slug: "me",
                      topic: "Profile",
                      title: "",
                      preview: "",
                      body: [],
                      author,
                      time: "",
                      views: "0",
                      likes: 0,
                      comments: 0,
                      evidenceLinks: []
                    }}
                  />
                  <div>
                    <div className="font-bold">{author.name}</div>
                    <div className="text-sm text-slate-500">{author.team}</div>
                  </div>
                </div>
              ) : (
                <div className="rounded-sm border border-dashed border-slate-300 p-4">
                  <p className="text-sm text-slate-500">Sign in to write posts, reply, save discussions, and sync your archive.</p>
                  <Link
                    href="/auth/sign-in"
                    className="mt-3 inline-flex rounded-sm bg-black px-5 py-2 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    Sign in
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <UserRound className="h-5 w-5 text-emerald-600" />
              <h2 className="font-bold">Topics</h2>
            </div>
            <div className="max-h-[420px] overflow-y-auto py-2">
              {communityTopics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setActiveTopic(topic)}
                  className={`flex w-full items-center justify-between px-5 py-3 text-left text-sm font-semibold hover:bg-slate-50 ${
                    activeTopic === topic ? "text-orange-600" : "text-slate-700"
                  }`}
                >
                  <span>{topic}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="flex items-center gap-3 bg-white px-5 py-4 shadow-sm">
            <span className="rounded-sm bg-black px-3 py-1 text-xs font-bold text-white">Community update</span>
            <p className="text-sm font-semibold text-slate-600">Share build evidence, flight notes, and engineering questions with real-name profiles.</p>
          </div>

          <section className="bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <ThumbsUp className="h-5 w-5 text-orange-500" />
                <h2 className="font-bold">Best posts</h2>
              </div>
              <button type="button" onClick={() => setSortMode("Best")} className="text-sm font-semibold text-slate-500 underline underline-offset-4">
                View all
              </button>
            </div>
            {bestPosts.length ? (
              bestPosts.map((post) => <CompactPostRow key={post.slug} post={post} />)
            ) : (
              <div className="px-5 py-6 text-sm text-slate-500">No ranked discussions yet. The first useful post will appear here.</div>
            )}
          </section>

          <section className="bg-white p-4 shadow-sm">
            {isSignedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => setComposerOpen(true)}
                  className="flex w-full items-center gap-4 rounded-sm bg-slate-50 px-5 py-4 text-left text-slate-500 hover:bg-slate-100"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-200">
                    <PenLine className="h-5 w-5" />
                  </span>
                  <span className="font-semibold">What engineering question or result do you want to share?</span>
                </button>

                {composerOpen ? (
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                      <select
                        value={draft.topic}
                        onChange={(event) => setDraft((current) => ({ ...current, topic: event.target.value }))}
                        className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-orange-400"
                      >
                        {communityTopics.filter((topic) => topic !== "All topics").map((topic) => (
                          <option key={topic}>{topic}</option>
                        ))}
                      </select>
                      <input
                        value={draft.title}
                        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Post title"
                        className="rounded-sm border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-orange-400"
                      />
                    </div>
                    <textarea
                      value={draft.body}
                      onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                      placeholder="Write with enough context for another builder to understand the design, test, data, or issue."
                      className="min-h-32 w-full rounded-sm border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-orange-400"
                    />
                    {draft.images.length ? (
                      <div className="grid grid-cols-4 gap-2">
                        {draft.images.map((image, index) => (
                          <div key={`${image}-${index}`} className="relative">
                            <figure className="relative aspect-video overflow-hidden rounded-sm border border-slate-200 bg-slate-50">
                              <img src={image} alt="" className="absolute inset-0 h-full w-full object-contain" />
                            </figure>
                            <button
                              type="button"
                              onClick={() => setDraft((current) => ({ ...current, images: current.images.filter((_, itemIndex) => itemIndex !== index) }))}
                              className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                              aria-label="Remove image"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                        <ImagePlus className="h-4 w-4" />
                        Attach images
                        <input type="file" accept="image/*" multiple onChange={attachImages} className="hidden" />
                      </label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setComposerOpen(false)} className="px-3 py-2 text-sm font-semibold text-slate-500">
                          Cancel
                        </button>
                        <Button onClick={submitPost} disabled={!draft.title.trim() || !draft.body.trim()} className="rounded-sm bg-orange-500 px-5 text-white hover:bg-orange-600">
                          Publish post
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex items-center justify-between gap-4 rounded-sm bg-slate-50 px-5 py-4">
                <p className="font-semibold text-slate-600">Sign in to start a real-name engineering discussion.</p>
                <Link href="/auth/sign-in" className="rounded-sm bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600">
                  Sign in
                </Link>
              </div>
            )}
          </section>

          <section className="bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold">New feed</h2>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none"
              >
                <option>Newest</option>
                <option>Best</option>
                <option>Most viewed</option>
              </select>
            </div>
            {visiblePosts.length ? (
              visiblePosts.map((post) => (
                <FeedPost
                  key={post.slug}
                  post={post}
                  liked={liked.has(post.slug)}
                  bookmarked={bookmarked.has(post.slug)}
                  reported={reported.has(post.slug)}
                  onLike={() => toggleSet(LIKED_POSTS_KEY, setLiked, liked, post.slug)}
                  onBookmark={() => toggleSet(BOOKMARKED_POSTS_KEY, setBookmarked, bookmarked, post.slug)}
                  onReport={() => toggleSet(REPORTED_POSTS_KEY, setReported, reported, post.slug)}
                />
              ))
            ) : (
              <div className="px-5 py-16 text-center">
                <MessageSquare className="mx-auto h-10 w-10 text-slate-300" />
                <h3 className="mt-4 text-lg font-bold">No community posts yet</h3>
                <p className="mt-2 text-sm text-slate-500">Real posts from signed-in builders will appear here in newest-first order.</p>
              </div>
            )}
          </section>
        </section>

        <aside className="space-y-5 lg:sticky lg:top-20">
          <section className="bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold">Recommended</h2>
              <button type="button" onClick={() => setSortMode("Best")} className="text-sm font-semibold text-slate-500 underline underline-offset-4">
                More
              </button>
            </div>
            {recommendedPosts.length ? (
              recommendedPosts.map((post) => <CompactPostRow key={post.slug} post={post} />)
            ) : (
              <div className="px-5 py-6 text-sm text-slate-500">Recommended posts will appear after builders publish discussions.</div>
            )}
          </section>

          <section className="bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" />
              <h2 className="font-bold">Community rules</h2>
            </div>
            <div className="space-y-3 text-sm leading-6 text-slate-500">
              <p>Use real identities. Share engineering context, not unsafe manufacturing instructions.</p>
              <p>Attach evidence when discussing flight results, test data, or marketplace claims.</p>
              <p>Report harmful payload, targeting, or weaponization content.</p>
            </div>
          </section>

          {archiveStatus ? <p className="rounded-sm bg-white px-4 py-3 text-xs font-semibold text-slate-500 shadow-sm">{archiveStatus}</p> : null}
        </aside>
      </div>

      {!isSignedIn ? (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-black/85 px-4 py-4 text-white backdrop-blur">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold">Join Rocketry House</div>
              <div className="text-sm text-white/70">Sign in to publish posts, save discussions, and sync your engineering archive.</div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/auth/sign-in" className="rounded-sm border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">
                Sign in
              </Link>
              <Link href="/auth/sign-up" className="rounded-sm bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600">
                Create account
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
