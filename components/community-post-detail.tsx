"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bookmark, Eye, Flag, MessageSquare, MoreVertical, Share2, ThumbsUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  CommunityComment,
  CommunityPost,
  communityComments,
  communityPosts,
  guestCommunityUser,
  getCommunityAuthorFromAuth
} from "@/lib/community-data";
import { readMockUser, restoreAuthUserFromCloud, type AuthUser } from "@/lib/auth";
import { loadPersistentSet, savePersistentSet } from "@/lib/cloud-persistence";
import { loadCommunityCommentsArchive, loadCommunityPostsArchive, saveCommunityCommentsArchive } from "@/lib/community-archive";

const LOCAL_POSTS_KEY = "rocketry-house-community-posts";
const LIKED_POSTS_KEY = "rocketry-house-community-liked-posts";
const BOOKMARKED_POSTS_KEY = "rocketry-house-community-bookmarked-posts";
const REPORTED_POSTS_KEY = "rocketry-house-community-reported-posts";
const COMMENT_KEY_PREFIX = "rocketry-house-community-comments:";
const memoryStore = new Map<string, string>();

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
      // IndexedDB archive remains available when localStorage cannot accept more data.
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

function readStoredComments(slug: string) {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(getStoredItem(`${COMMENT_KEY_PREFIX}${slug}`) ?? "[]") as CommunityComment[];
  } catch {
    return [];
  }
}

function storeComments(slug: string, comments: CommunityComment[]) {
  setStoredItem(`${COMMENT_KEY_PREFIX}${slug}`, JSON.stringify(comments));
  void saveCommunityCommentsArchive(slug, comments);
}

export function CommunityPostDetail({ slug, initialPost, related }: { slug: string; initialPost?: CommunityPost; related: CommunityPost[] }) {
  const [post, setPost] = useState<CommunityPost | undefined>(initialPost);
  const [comments, setComments] = useState<CommunityComment[]>(initialPost?.commentList ?? communityComments);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [reported, setReported] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reply, setReply] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [author, setAuthor] = useState(guestCommunityUser);
  const [authNotice, setAuthNotice] = useState("");
  const [sortMode, setSortMode] = useState<"Most helpful" | "Newest">("Most helpful");

  useEffect(() => {
    const localPost = readStoredPosts().find((item) => item.slug === slug);
    const resolved = localPost ?? initialPost;
    setPost(resolved);
    const storedComments = readStoredComments(slug);
    setComments(storedComments.length ? storedComments : resolved?.commentList ?? communityComments);
    setLiked(readStoredSet(LIKED_POSTS_KEY).has(slug));
    setBookmarked(readStoredSet(BOOKMARKED_POSTS_KEY).has(slug));
    setReported(readStoredSet(REPORTED_POSTS_KEY).has(slug));
    void loadCommunityPostsArchive().then((posts) => {
      const archivedPost = posts.find((item) => item.slug === slug);
      if (archivedPost) setPost(archivedPost);
    });
    void loadCommunityCommentsArchive(slug).then((archivedComments) => {
      if (archivedComments.length) setComments(archivedComments);
    });
    void loadPersistentSet("community_state", LIKED_POSTS_KEY).then((value) => setLiked(value.has(slug)));
    void loadPersistentSet("community_state", BOOKMARKED_POSTS_KEY).then((value) => setBookmarked(value.has(slug)));
    void loadPersistentSet("community_state", REPORTED_POSTS_KEY).then((value) => setReported(value.has(slug)));
    const syncAuthor = () => {
      const nextUser = readMockUser();
      setUser(nextUser);
      setAuthor(getCommunityAuthorFromAuth(nextUser));
      if (!nextUser) setReply("");
    };
    syncAuthor();
    void restoreAuthUserFromCloud().then((cloudUser) => {
      setUser(cloudUser);
      setAuthor(getCommunityAuthorFromAuth(cloudUser));
      if (!cloudUser) setReply("");
    });
    window.addEventListener("rocketry-auth-change", syncAuthor);
    return () => window.removeEventListener("rocketry-auth-change", syncAuthor);
  }, [initialPost, slug]);

  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => sortMode === "Newest" ? b.id.localeCompare(a.id) : b.likes - a.likes);
  }, [comments, sortMode]);
  const isSignedIn = Boolean(user);

  function toggleStored(key: string, active: boolean, setter: (value: boolean) => void) {
    if (!isSignedIn) {
      setAuthNotice("Sign in or create an account to interact with community posts.");
      return;
    }
    const next = readStoredSet(key);
    if (active) next.delete(slug);
    else next.add(slug);
    storeSet(key, next);
    setter(!active);
  }

  function submitReply() {
    if (!user) {
      setAuthNotice("Sign in or create an account to reply.");
      return;
    }
    const body = reply.trim();
    if (!body) return;
    const comment: CommunityComment = {
      id: `local-comment-${Date.now()}`,
      author,
      body,
      time: "just now",
      likes: 0
    };
    const next = [comment, ...comments];
    setComments(next);
    storeComments(slug, next);
    setReply("");
  }

  async function sharePost() {
    if (typeof window === "undefined") return;
    await navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  if (!post) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#f5f4f0] px-4 pb-16 pt-20 text-slate-950 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-sm sm:p-8">
          <Link href="/community" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-600">
            <ArrowLeft className="h-4 w-4" />
            Back to community
          </Link>
          <h1 className="mt-6 text-3xl font-semibold">Post not found</h1>
          <p className="mt-2 text-slate-600">This post may only exist in another browser session, or it may have been removed by moderation.</p>
        </div>
      </main>
    );
  }

  const displayedLikes = post.likes + Number(liked);
  const displayedComments = comments.length;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f4f0] px-4 pb-16 pt-20 text-slate-950 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_320px] lg:gap-6">
        <section className="rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
            <Link href="/community" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-600">
              <ArrowLeft className="h-4 w-4" />
              Back to community
            </Link>
            <div className="flex shrink-0 items-center gap-1 text-slate-500 sm:gap-2">
              <button onClick={sharePost} className="rounded-full p-2 hover:bg-slate-100" aria-label="Share post"><Share2 className="h-5 w-5" /></button>
              <button onClick={() => toggleStored(BOOKMARKED_POSTS_KEY, bookmarked, setBookmarked)} className={`rounded-full p-2 hover:bg-slate-100 ${bookmarked ? "text-orange-600" : ""}`} aria-label="Save post"><Bookmark className="h-5 w-5" /></button>
              <MoreVertical className="h-5 w-5" />
            </div>
          </div>

          <article className="p-4 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <p className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">{post.topic}</p>
              {post.createdLocally ? <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">Drafted locally</span> : null}
              {copied ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">Link copied</span> : null}
            </div>
            <h1 className="mt-5 break-words text-3xl font-semibold leading-tight sm:text-4xl">{post.title}</h1>
            <p className="mt-3 text-sm text-slate-500">{post.time} / views {post.views}</p>

            <AuthorBlock post={post} />

            <div className="mt-7 space-y-5 text-base leading-8 text-slate-800 sm:mt-8 sm:space-y-6 sm:text-xl sm:leading-10">
              {post.body.map((paragraph) => (
                <p key={paragraph} className="break-words">{paragraph}</p>
              ))}
            </div>

            {post.images?.length ? (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {post.images.map((image, index) => (
                  <figure key={`${image}-${index}`} className="grid min-h-48 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
                    <img src={image} alt={`Community attachment ${index + 1}`} className="max-h-[720px] max-w-full object-contain" />
                  </figure>
                ))}
              </div>
            ) : null}

            <div className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-3">
              <EvidencePill label="Linked project" value={post.linkedProject ?? "No project attached"} />
              <EvidencePill label="Evidence" value={post.evidenceLinks.length ? post.evidenceLinks.join(", ") : "No evidence links attached"} />
              <EvidencePill label="Visible identity" value={`${post.author.name}, ${post.author.team}`} />
            </div>

            <div className="mt-8 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-700 sm:flex sm:flex-wrap sm:items-center sm:justify-around sm:gap-3 sm:p-4">
              <button onClick={() => toggleStored(LIKED_POSTS_KEY, liked, setLiked)} className={`flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 font-semibold sm:bg-transparent sm:py-0 ${liked ? "text-orange-700" : ""}`}><ThumbsUp className="h-5 w-5" /> Like {displayedLikes}</button>
              <a href="#comments" className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 font-semibold sm:bg-transparent sm:py-0"><MessageSquare className="h-5 w-5" /> Comments {displayedComments}</a>
              <button onClick={() => toggleStored(REPORTED_POSTS_KEY, reported, setReported)} className={`flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 font-semibold sm:bg-transparent sm:py-0 ${reported ? "text-red-600" : ""}`}><Flag className="h-5 w-5" /> {reported ? "Reported" : "Report"}</button>
            </div>
            {authNotice ? (
              <p className="mt-4 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700">
                {authNotice}
              </p>
            ) : null}
          </article>

          <section id="comments" className="border-t border-slate-200 p-4 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold sm:text-2xl">Comments {displayedComments}</h2>
              <div className="flex gap-3 text-sm">
                <button onClick={() => setSortMode("Most helpful")} className={sortMode === "Most helpful" ? "font-semibold text-slate-900" : "text-slate-400"}>Most helpful</button>
                <button onClick={() => setSortMode("Newest")} className={sortMode === "Newest" ? "font-semibold text-slate-900" : "text-slate-400"}>Newest</button>
              </div>
            </div>

            <div className="mt-5 space-y-6">
              {sortedComments.map((comment) => (
                <div key={comment.id} className="flex gap-3 border-b border-slate-100 pb-6 last:border-b-0 sm:gap-4">
                  <Avatar name={comment.author.name} avatarUrl={comment.author.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{comment.author.name}</p>
                      <p className="text-sm text-slate-500">{comment.author.role}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{comment.author.profileType}</span>
                    </div>
                    <p className="mt-2 break-words leading-7 text-slate-700">{comment.body}</p>
                    <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
                      <span>{comment.time}</span>
                      <button className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" />{comment.likes}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg sm:sticky sm:bottom-0 sm:p-4">
              {isSignedIn ? (
                <div className="flex gap-3">
                  <Avatar name={author.name} avatarUrl={author.avatarUrl} />
                  <div className="flex-1">
                    <textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      className="min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-300"
                      placeholder={`Write as ${author.name}`}
                    />
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-500">Real-name reply. Keep it technical, lawful, and evidence-oriented.</p>
                      <button onClick={submitReply} className="rounded-md bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-400 sm:py-2">Post reply</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">Sign in to reply</p>
                    <p className="mt-1 text-sm text-slate-500">Community replies use real account identity and team or organization context.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Link href="/auth/sign-in" className="inline-flex h-11 items-center justify-center rounded-md bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-400">Sign in</Link>
                    <Link href="/auth/sign-up" className="inline-flex h-11 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign up</Link>
                  </div>
                </div>
              )}
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <Card className="border-slate-200 bg-white p-4 text-slate-950 shadow-sm sm:p-5">
            <h2 className="font-semibold">Post metrics</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <Metric label="Views" value={post.views} />
              <Metric label="Likes" value={String(displayedLikes)} />
              <Metric label="Replies" value={String(displayedComments)} />
            </div>
          </Card>

          <Card className="border-slate-200 bg-white p-4 text-slate-950 shadow-sm sm:p-5">
            <h2 className="font-semibold">Recommended posts</h2>
            <div className="mt-4 space-y-4">
              {related.map((item) => (
                <Link key={item.slug} href={`/community/${item.slug}`} className="block border-b border-slate-100 pb-4 last:border-b-0">
                  <p className="text-sm text-slate-500">{item.topic}</p>
                  <p className="mt-1 font-semibold leading-snug text-slate-900">{item.title}</p>
                  <PostStats views={item.views} likes={item.likes} comments={item.comments} />
                </Link>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}

function AuthorBlock({ post }: { post: CommunityPost }) {
  return (
    <div className="mt-5 flex items-start gap-3">
      <Avatar name={post.author.name} avatarUrl={post.author.avatarUrl} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{post.author.name}</p>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{post.author.badge}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{post.author.profileType}</span>
        </div>
        <p className="break-words text-sm text-slate-500">{post.author.role} / {post.author.team}</p>
      </div>
    </div>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  return (
    avatarUrl ? (
      <img src={avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
    ) : (
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-200 to-violet-300 font-bold text-slate-900">
        {name.trim()[0] ?? "R"}
      </div>
    )
  );
}

function EvidencePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 break-words font-medium text-slate-700">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="font-semibold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function PostStats({ views, likes, comments }: { views: string; likes: number; comments: number }) {
  return (
    <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
      <span className="flex items-center gap-1"><Eye className="h-4 w-4" />{views}</span>
      <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" />{likes}</span>
      <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4" />{comments}</span>
    </div>
  );
}
