import "server-only";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { config } from "./config";
import { one, q, type User } from "./db";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "nokos_sesi";
const MAX_AGE = 30 * 24 * 3600;

export async function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString("hex")}$${h.toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const got = await scrypt(pw, Buffer.from(salt, "hex"), 32);
  const want = Buffer.from(hash, "hex");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Buat sesi login baru. Hanya bisa dipanggil dari Server Action / Route Handler. */
export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  await q("INSERT INTO nokos.sessions(token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')",
    [sha(token), userId]);
  await q("UPDATE nokos.users SET last_login = now() WHERE id = $1", [userId]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: config.cookieSecure, path: "/", maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q("DELETE FROM nokos.sessions WHERE token_hash = $1", [sha(token)]);
  jar.delete(COOKIE);
}

/** Pengguna yang sedang login (null kalau belum). Di-cache per request. */
export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return one<User>(
    `SELECT u.* FROM nokos.sessions s JOIN nokos.users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.banned = FALSE`,
    [sha(token)]);
});

export const isAdmin = (u: Pick<User, "email"> | null | undefined) =>
  Boolean(u && config.adminEmails.has(u.email.toLowerCase()));

export async function requireUser(next = "/app") {
  const u = await getUser();
  if (!u) redirect(`/masuk?next=${encodeURIComponent(next)}`);
  return u;
}

export async function requireAdmin() {
  const u = await requireUser("/admin");
  if (!isAdmin(u)) redirect("/app");
  return u;
}

export async function cleanupSessions() {
  await q("DELETE FROM nokos.sessions WHERE expires_at < now()");
}
