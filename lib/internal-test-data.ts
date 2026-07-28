import type { RocketProject } from "@/lib/types";

const internalTestAccountPatterns = [
  /\bRH QA\b/i,
  /\bQA (?:Sender|Receiver)\b/i
];

const internalTestMessagePatterns = [
  /^RH QA UI direct message\b/i,
  /^RH QA direct message\b/i
];

export function containsInternalTestMarker(values: Array<unknown>) {
  const text = values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(" ");
  return internalTestAccountPatterns.some((pattern) => pattern.test(text));
}

export function isInternalTestMessageBody(value: unknown) {
  return typeof value === "string" && internalTestMessagePatterns.some((pattern) => pattern.test(value));
}

export function isInternalTestProject(project: Pick<RocketProject, "id" | "slug" | "title" | "creator" | "description" | "tags">) {
  return containsInternalTestMarker([project.id, project.slug, project.title, project.creator, project.description, project.tags]);
}
