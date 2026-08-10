import { EXTERNAL_CFD_CACHE_LIMIT } from "./constants";
import type { ExternalCfdResult } from "./types";

const resultCache = new Map<string, ExternalCfdResult>();

export function getExternalCfdCache(key: string) {
  const value = resultCache.get(key);
  if (!value) return null;
  resultCache.delete(key);
  resultCache.set(key, value);
  return { ...value, metadata: { ...value.metadata, cacheHit: true } };
}

export function setExternalCfdCache(key: string, value: ExternalCfdResult) {
  resultCache.set(key, value);
  while (resultCache.size > EXTERNAL_CFD_CACHE_LIMIT) {
    const oldest = resultCache.keys().next().value as string | undefined;
    if (!oldest) break;
    resultCache.delete(oldest);
  }
}
