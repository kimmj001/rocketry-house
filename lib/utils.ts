import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function bySlug<T extends { slug: string }>(items: T[], slug: string) {
  const aliases: Record<string, string> = {
    "openrocket-replacement-demo-rocket": "copenhagen-nexo-ii-reference",
    "aurora-fg-research-airframe": "copenhagen-nexo-ii-reference",
    "loc-iv-certification-reference": "copenhagen-nexo-ii-reference"
  };
  const resolvedSlug = aliases[slug] ?? slug;
  return items.find((item) => item.slug === resolvedSlug);
}

export function canonicalSlug(slug: string) {
  const aliases: Record<string, string> = {
    "openrocket-replacement-demo-rocket": "copenhagen-nexo-ii-reference",
    "aurora-fg-research-airframe": "copenhagen-nexo-ii-reference",
    "loc-iv-certification-reference": "copenhagen-nexo-ii-reference"
  };
  return aliases[slug] ?? slug;
}
