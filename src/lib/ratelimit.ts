import "server-only";
import { headers } from "next/headers";

const g = globalThis as unknown as { __nokosHits?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__nokosHits ??= new Map<string, number[]>());

/** true kalau sudah melebihi batas `limit` kali dalam `windowSec` detik. */
export function rateLimited(key: string, limit: number, windowSec: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowSec * 1000);
  const limited = list.length >= limit;
  if (!limited) list.push(now);
  hits.set(key, list);
  if (hits.size > 50_000) hits.clear();
  return limited;
}

export async function clientIp() {
  const h = await headers();
  return h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "?";
}
