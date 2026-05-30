"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bookmark,
  ImagePlus,
  ChevronDown,
  ChevronRight,
  Eye,
  Flag,
  MessageSquare,
  PenLine,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  ThumbsUp,
  UserRound,
  UsersRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CommunityPost,
  communityPosts,
  communityTopics,
  currentCommunityUser
} from "@/lib/community-data";

const LOCAL_POSTS_KEY = "rocketry-house-community-posts";
const LIKED_POSTS_KEY = "rocketry-house-community-liked-posts";
const BOOKMARKED_POSTS_KEY = "rocketry-house-community-bookmarked-posts";
const REPORTED_POSTS_KEY = "rocketry-house-community-reported-posts";
const memoryStore = new Map<string, string>();

function getStoredItem(key: string) {
  if (typeof window === "undefined" || !window.localStorage) return memoryStore.get(key) ?? null;
  return window.localStorage.getItem(key);
}

function setStoredItem(key: string, value: string) {
  memoryStore.set(key, value);
  if (typeof window !== "undefined" && window.localStorage) window.localStorage.setItem(key, value);
}

type SortMode = "Best" | "Newest" | "Most viewed";

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
}

function slugify(value: string) {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "community-post"}-${Date.now().toString(36)}`;
}

function viewNumber(value: string) {
  return Number(value.replace(/,/g, "")) || 0;
}

export function CommunityBoard() {
  const [localPosts, setLocalPosts] = useState<CommunityPost[]>([]);
  const [activeTopic, setActiveTopic] = useState("All topics");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("Best");
  const [composerOpen, setComposerOpen] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState({
    topic: "CAD review",
    title: "",
    body: "",
    linkedProject: "",
    evidenceLinks: "",
    images: [] as string[]
  });

  useEffect(() => {
    setLocalPosts(readStoredPosts());
    setLiked(readStoredSet(LIKED_POSTS_KEY));
    setBookmarked(readStoredSet(BOOKMARKED_POSTS_KEY));
    setReported(readStoredSet(REPORTED_POSTS_KEY));
  }, []);

  const posts = useMemo(() => [...localPosts, ...communityPosts], [localPosts]);
  const visiblePosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = posts.filter((post) => {
      const matchesTopic = activeTopic === "All topics" || post.topic === activeTopic;
      const haystack = [post.title, post.preview, post.topic, post.author.name, post.author.team, post.linkedProject, ...post.evidenceLinks].join(" ").toLowerCase();
      return matchesTopic && (!normalizedQuery || haystack.includes(normalizedQuery));
    });

    return filtered.sort((a, b) => {
      if (sortMode === "Newest") return Number(Boolean(b.createdLocally)) - Number(Boolean(a.createdLocally));
      if (sortMode === "Most viewed") return viewNumber(b.views) - viewNumber(a.views);
      return b.likes + b.comments * 2 + Number(Boolean(b.best)) * 500 - (a.likes + a.comments * 2 + Number(Boolean(a.best)) * 500);
    });
  }, [activeTopic, posts, query, sortMode]);

  const bestPosts = visiblePosts.filter((post) => post.best || post.likes > 150).slice(0, 3);
  const recommendedPosts = visiblePosts.filter((post) => post.recommended || bookmarked.has(post.slug)).slice(0, 5);

  function toggleSet(slug: string, key: string, setter: (value: Set<string>) => void, current: Set<string>) {
    const next = new Set(current);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setter(next);
    storeSet(key, next);
  }

  function submitPost() {
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) return;

    const paragraphs = body.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
    const post: CommunityPost = {
      slug: slugify(title),
      topic: draft.topic,
      title,
      preview: paragraphs[0]?.slice(0, 180) ?? body.slice(0, 180),
      body: paragraphs.length ? paragraphs : [body],
      author: currentCommunityUser,
      time: "just now",
      views: "0",
      likes: 0,
      comments: 0,
      evidenceLinks: draft.evidenceLinks.split(",").map((item) => item.trim()).filter(Boolean),
      images: draft.images,
      linkedProject: draft.linkedProject.trim() || undefined,
      createdLocally: true,
      commentList: []
    };

    const next = [post, ...localPosts];
    setLocalPosts(next);
    setStoredItem(LOCAL_POSTS_KEY, JSON.stringify(next));
    setDraft({ topic: "CAD review", title: "", body: "", linkedProject: "", evidenceLinks: "", images: [] });
    setComposerOpen(false);
  }

  function attachImages(files: FileList | null) {
    if (!files?.length) return;
    Array.from(files).slice(0, 4).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const value = typeof reader.result === "string" ? reader.result : "";
        if (!value) return;
        setDraft((current) => ({ ...current, images: [...current.images, value].slice(0, 4) }));
      };
      reader.readAsDataURL(file);
    });
  }

  return (
    <main className="min-h-screen bg-[#f5f4f0] px-6 py-24 text-slate-950">
      <div className="mx-auto max-w-[1440px]">
        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Community</p>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">Real-name only</span>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">No anonymous posting</span>
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight md:text-5xl">
              Practical discussions for rocket builders, teams, and organizations.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Ask for CAD review, compare flight data, publish build notes, and keep every reply tied to a visible engineering identity.
            </p>
          </div>

          <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">My community</h2>
              <div className="flex gap-2 text-slate-500">
                <Search className="h-5 w-5" />
                <UserRound className="h-5 w-5" />
                <Bell className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={currentCommunityUser.name} />
              <div>
                <p className="font-semibold">{currentCommunityUser.name}</p>
                <p className="text-sm text-slate-500">{currentCommunityUser.role}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <Button className="bg-orange-500 text-white hover:bg-orange-400" onClick={() => setComposerOpen(true)}>
                <PenLine className="h-4 w-4" />
                Write post
              </Button>
              <Button variant="outline" className="border-slate-200 bg-white text-slate-800 hover:bg-slate-50">
                <UsersRound className="h-4 w-4" />
                My team discussions
              </Button>
            </div>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
              Posts and replies display real name, role, profile type, and team or organization.
            </p>
          </Card>
        </section>

        {composerOpen ? (
          <section className="mt-6 rounded-2xl border border-orange-200 bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Write with verified profile</h2>
                <p className="mt-1 text-sm text-slate-500">Visible author: {currentCommunityUser.name}, {currentCommunityUser.team}</p>
              </div>
              <button className="text-sm font-semibold text-slate-500 hover:text-slate-900" onClick={() => setComposerOpen(false)}>Close</button>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr]">
              <label className="text-sm font-medium text-slate-600">
                Topic
                <select value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900 outline-none focus:border-orange-300">
                  {communityTopics.filter((topic) => topic !== "All topics").map((topic) => <option key={topic}>{topic}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-600">
                Title
                <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900 outline-none focus:border-orange-300" placeholder="What do you want other builders to review?" />
              </label>
              <label className="text-sm font-medium text-slate-600 lg:col-span-2">
                Body
                <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} className="mt-1 min-h-40 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900 outline-none focus:border-orange-300" placeholder="Write the situation, assumptions, data attached, and the decision you need help with." />
              </label>
              <label className="text-sm font-medium text-slate-600">
                Linked project
                <input value={draft.linkedProject} onChange={(event) => setDraft({ ...draft, linkedProject: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900 outline-none focus:border-orange-300" placeholder="Optional project name" />
              </label>
              <label className="text-sm font-medium text-slate-600">
                Evidence links
                <input value={draft.evidenceLinks} onChange={(event) => setDraft({ ...draft, evidenceLinks: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900 outline-none focus:border-orange-300" placeholder="CSV, CAD version, photo set" />
              </label>
              <div className="lg:col-span-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-600 transition hover:border-orange-300 hover:bg-orange-50">
                  <ImagePlus className="h-5 w-5" />
                  Attach photos for evidence or build context
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => attachImages(event.target.files)} />
                </label>
                {draft.images.length ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {draft.images.map((image, index) => (
                      <div key={image} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <img src={image} alt={`Attached community image ${index + 1}`} className="h-32 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setDraft((current) => ({ ...current, images: current.images.filter((_, itemIndex) => itemIndex !== index) }))}
                          className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">Safety note: do not post harmful payloads, targeting workflows, or propellant manufacturing instructions.</p>
              <Button className="bg-orange-500 text-white hover:bg-orange-400" onClick={submitPost}>Publish post</Button>
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid gap-5 lg:grid-cols-[260px_1fr_330px]">
          <aside className="space-y-5">
            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                <Search className="h-4 w-4" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent outline-none" placeholder="Search posts" />
              </label>
              <h2 className="mt-5 font-semibold">Topics</h2>
              <div className="mt-3 flex flex-wrap gap-2 lg:block lg:space-y-2">
                {communityTopics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => setActiveTopic(topic)}
                    className={`rounded-full border px-3 py-2 text-sm transition lg:flex lg:w-full lg:items-center lg:justify-between lg:rounded-lg ${
                      topic === activeTopic
                        ? "border-orange-200 bg-orange-50 font-semibold text-orange-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>{topic}</span>
                    {topic === activeTopic ? <ChevronRight className="hidden h-4 w-4 lg:block" /> : null}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Trust model
              </h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>Real name and role are shown on every post and reply.</p>
                <p>Teams and organizations can verify members.</p>
                <p>Unsafe or unlawful content can be reported for review.</p>
              </div>
            </Card>
          </aside>

          <div className="space-y-5">
            <section className="rounded-2xl bg-slate-100 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Best posts</h2>
                <button onClick={() => setSortMode("Best")} className="flex items-center gap-1 text-sm text-slate-500">
                  View ranked
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {bestPosts.map((post) => (
                  <PostCard
                    key={post.slug}
                    post={post}
                    liked={liked.has(post.slug)}
                    bookmarked={bookmarked.has(post.slug)}
                    reported={reported.has(post.slug)}
                    toggleLike={() => toggleSet(post.slug, LIKED_POSTS_KEY, setLiked, liked)}
                    toggleBookmark={() => toggleSet(post.slug, BOOKMARKED_POSTS_KEY, setBookmarked, bookmarked)}
                    toggleReport={() => toggleSet(post.slug, REPORTED_POSTS_KEY, setReported, reported)}
                    compact
                  />
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
                <h2 className="text-2xl font-semibold">Feed</h2>
                <label className="flex items-center gap-2 text-sm text-slate-500">
                  <SlidersHorizontal className="h-4 w-4" />
                  <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="rounded-md border border-slate-200 bg-white px-2 py-2 text-slate-700">
                    <option>Best</option>
                    <option>Newest</option>
                    <option>Most viewed</option>
                  </select>
                </label>
              </div>
              <div>
                {visiblePosts.length ? visiblePosts.map((post) => (
                  <PostCard
                    key={post.slug}
                    post={post}
                    liked={liked.has(post.slug)}
                    bookmarked={bookmarked.has(post.slug)}
                    reported={reported.has(post.slug)}
                    toggleLike={() => toggleSet(post.slug, LIKED_POSTS_KEY, setLiked, liked)}
                    toggleBookmark={() => toggleSet(post.slug, BOOKMARKED_POSTS_KEY, setBookmarked, bookmarked)}
                    toggleReport={() => toggleSet(post.slug, REPORTED_POSTS_KEY, setReported, reported)}
                  />
                )) : (
                  <div className="p-8 text-center text-slate-500">
                    <p className="font-semibold text-slate-800">No posts match this filter.</p>
                    <p className="mt-1 text-sm">Try another topic or write the first post for this category.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="font-semibold">Profile activity</h2>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <ProfileStat label="Posts" value={String(12 + localPosts.length)} />
                <ProfileStat label="Likes" value={String(438 + liked.size)} />
                <ProfileStat label="Saved" value={String(bookmarked.size)} />
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="flex items-center gap-2 font-semibold">
                <Star className="h-5 w-5 text-orange-500" />
                Recommended posts
              </h2>
              <div className="mt-4 space-y-4">
                {recommendedPosts.map((post) => (
                  <Link key={post.slug} href={`/community/${post.slug}`} className="block border-b border-slate-100 pb-4 last:border-b-0">
                    <p className="text-sm text-slate-500">{post.topic}</p>
                    <p className="mt-1 text-base font-semibold leading-snug text-slate-900">{post.title}</p>
                    <PostStats views={post.views} likes={post.likes + Number(liked.has(post.slug))} comments={post.comments} compact />
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="flex items-center gap-2 font-semibold">
                <Flag className="h-5 w-5 text-slate-500" />
                Moderation
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Reports mark posts for admin review. Rocketry House removes unsafe, unlawful, or weaponization-oriented content.
              </p>
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Reported this session: {reported.size}</p>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}

function PostCard({
  post,
  liked,
  bookmarked,
  reported,
  toggleLike,
  toggleBookmark,
  toggleReport,
  compact = false
}: {
  post: CommunityPost;
  liked: boolean;
  bookmarked: boolean;
  reported: boolean;
  toggleLike: () => void;
  toggleBookmark: () => void;
  toggleReport: () => void;
  compact?: boolean;
}) {
  return (
    <article className={`${compact ? "rounded-xl border border-slate-200 bg-white p-4" : "border-b border-slate-200 p-5 last:border-b-0"} transition hover:bg-slate-50`}>
      <div className="flex items-start justify-between gap-4">
        <Link href={`/community/${post.slug}`} className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500">{post.topic}</p>
          <h3 className={`${compact ? "mt-2 text-lg" : "mt-2 text-2xl"} font-semibold leading-tight text-slate-950`}>
            <span className="mr-2 text-orange-500">•</span>
            {post.title}
          </h3>
          {!compact ? <p className="mt-3 line-clamp-2 text-lg leading-8 text-slate-500">{post.preview}</p> : null}
        </Link>
        <div className="flex gap-1 text-slate-400">
          <IconButton active={bookmarked} label="Save post" onClick={toggleBookmark}><Bookmark className="h-4 w-4" /></IconButton>
          <IconButton active={reported} label="Report post" onClick={toggleReport}><Flag className="h-4 w-4" /></IconButton>
        </div>
      </div>
      {!compact ? <AuthorBlock post={post} /> : null}
      {post.images?.length ? <ImageStrip images={post.images} compact={compact} /> : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <PostStats views={post.views} likes={post.likes + Number(liked)} comments={post.comments} compact={compact} />
        <div className="flex gap-2">
          <button onClick={toggleLike} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold ${liked ? "border-orange-200 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            <ThumbsUp className="h-4 w-4" />
            Like
          </button>
          <Link href={`/community/${post.slug}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">
            <MessageSquare className="h-4 w-4" />
            Reply
          </Link>
        </div>
      </div>
    </article>
  );
}

function ImageStrip({ images, compact }: { images: string[]; compact?: boolean }) {
  return (
    <div className={`mt-4 grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3"}`}>
      {images.slice(0, compact ? 2 : 3).map((image, index) => (
        <img key={`${image}-${index}`} src={image} alt={`Community attachment ${index + 1}`} className={`${compact ? "h-24" : "h-40"} w-full rounded-xl border border-slate-200 object-cover`} />
      ))}
    </div>
  );
}

function AuthorBlock({ post }: { post: CommunityPost }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <Avatar name={post.author.name} />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{post.author.name}</p>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{post.author.badge}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{post.author.profileType}</span>
        </div>
        <p className="text-sm text-slate-500">{post.author.role} / {post.author.team} / {post.time}</p>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-200 to-violet-300 font-bold text-slate-900">
      {name.trim()[0] ?? "R"}
    </div>
  );
}

function PostStats({ views, likes, comments, compact = false }: { views: string; likes: number; comments: number; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-4 text-slate-500 ${compact ? "text-sm" : "text-base"}`}>
      <span className="flex items-center gap-1"><Eye className="h-4 w-4" />{views}</span>
      <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" />{likes}</span>
      <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4" />{comments}</span>
    </div>
  );
}

function IconButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={`rounded-full p-2 transition ${active ? "bg-orange-50 text-orange-700" : "hover:bg-slate-100 hover:text-slate-700"}`}>
      {children}
    </button>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="font-semibold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
