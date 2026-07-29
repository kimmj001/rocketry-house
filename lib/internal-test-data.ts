import type { CommunityComment, CommunityPost } from "@/lib/community-data";
import type { RocketProject } from "@/lib/types";

const internalTestAccountPatterns = [
  /\bRH QA\b/i,
  /\bQA (?:Sender|Receiver)\b/i,
  /\bQA verifier\b/i,
  /\bArchive Tester\b/i,
  /\bRocketry House Upload QA\b/i
];

const internalTestMessagePatterns = [
  /^RH QA UI direct message\b/i,
  /^RH QA direct message\b/i
];

const internalTestContentPatterns = [
  /\bproduction QA\b/i,
  /\bwrite-flow community post\b/i,
  /\bcloud archive test\b/i,
  /\bTesting cloud archive persistence\b/i,
  /\bCodex cloud archive test\b/i
];

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings);
  return [];
}

function normalized(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

export function containsInternalTestMarker(values: Array<unknown>) {
  const text = values.flatMap(collectStrings).join(" ");
  return internalTestAccountPatterns.some((pattern) => pattern.test(text)) || internalTestContentPatterns.some((pattern) => pattern.test(text));
}

export function isInternalTestMessageBody(value: unknown) {
  return typeof value === "string" && internalTestMessagePatterns.some((pattern) => pattern.test(value));
}

export function isInternalTestProject(project: Pick<RocketProject, "id" | "slug" | "title" | "creator" | "description" | "tags">) {
  return containsInternalTestMarker([project.id, project.slug, project.title, project.creator, project.description, project.tags]);
}

export function isHiddenCommunityComment(comment: Pick<CommunityComment, "id" | "author" | "body">) {
  return containsInternalTestMarker([comment.id, comment.author, comment.body]);
}

export function isHiddenCommunityPost(
  post: Pick<CommunityPost, "slug" | "title" | "preview" | "body" | "author" | "evidenceLinks" | "linkedProject" | "commentList">
) {
  const title = normalized(post.title);
  const preview = normalized(post.preview);
  const placeholderPost = (title === "test" && preview === "aa") || (title === "hi there!" && preview === "this is admin and welcome!");

  return placeholderPost || containsInternalTestMarker([post.slug, post.title, post.preview, post.body, post.author, post.evidenceLinks, post.linkedProject, post.commentList]);
}
