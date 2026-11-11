"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { config } from "@/lib/config";
import { one, q, type User } from "@/lib/db";
import { clientIp, rateLimited } from "@/lib/ratelimit";
import { cancelDeposit, createDeposit, ShopError } from "@/lib/shop";

export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | null;

const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const safeNext = (u: string) => (u.startsWith("/") && !u.startsWith("//") ? u : "/app");
const digits = (s: string) => Number(s.replace(/\D/g, "") || 0);

export async function loginAction(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email").toLowerCase();
  const password = String(f.get("password") ?? "");
  const next = safeNext(str(f, "next") || "/app");
  const ip = await clientIp();
  if (rateLimited(`login:${ip}`, 10, 600) || rateLimited(`login:${email}`, 8, 600))
    return { error: "Terlalu banyak percobaan. Tunggu 10 menit lalu coba lagi.", values: { email } };
  const u = await one<User>("SELECT * FROM nokos.users WHERE email = $1", [email]);
  if (!u || !(await verifyPassword(password, u.password_hash))) return { error: "Email atau password salah.", values: { email } };
  if (u.banned) return { error: "Akun ini diblokir. Hubungi CS.", values: { email } };
  await createSession(u.id);
  redirect(next);
}

export async function registerAction(_: FormState, f: FormData): Promise<FormState> {
  const name = str(f, "name").slice(0, 60);
  const email = str(f, "email").toLowerCase();
  const password = String(f.get("password") ?? "");
  const values = { name, email };
  if (rateLimited(`reg:${await clientIp()}`, 5, 3600)) return { error: "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.", values };
  if (name.length < 2) return { error: "Isi nama kamu.", values };
  if (!EMAIL_RE.test(email)) return { error: "Format email tidak valid.", values };
  if (password.length < 8) return { error: "Password minimal 8 karakter.", values };
  if (password !== String(f.get("password2") ?? "")) return { error: "Konfirmasi password tidak sama.", values };
  if (!f.get("setuju")) return { error: "Centang persetujuan aturan pemakaian dulu.", values };
  const created = await one<{ id: number }>(
    "INSERT INTO nokos.users(email, name, password_hash) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING RETURNING id",
    [email, name, await hashPassword(password)]);
  if (!created) return { error: "Email ini sudah terdaftar. Silakan masuk.", values };
  await createSession(created.id);
  redirect("/app?baru=1");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function changePasswordAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser("/akun");
  const old = String(f.get("old") ?? ""), nw = String(f.get("new") ?? "");
  if (!(await verifyPassword(old, u.password_hash))) return { error: "Password lama salah." };
  if (nw.length < 8) return { error: "Password baru minimal 8 karakter." };
  if (nw !== String(f.get("new2") ?? "")) return { error: "Konfirmasi password baru tidak sama." };
  await q("UPDATE nokos.users SET password_hash = $2 WHERE id = $1", [u.id, await hashPassword(nw)]);
  return { ok: "Password diganti." };
}

export async function createDepositAction(f: FormData) {
  const u = await requireUser("/deposit");
  const amount = digits(str(f, "amount_custom")) || digits(str(f, "amount"));
  if (amount < config.depositMin || amount > config.depositMax)
    redirect(`/deposit?err=${encodeURIComponent(`Nominal deposit Rp${config.depositMin.toLocaleString("id-ID")} sampai Rp${config.depositMax.toLocaleString("id-ID")}.`)}`);
  if (rateLimited(`dep:${u.id}`, 8, 900)) redirect(`/deposit?err=${encodeURIComponent("Terlalu banyak tagihan dibuat. Tunggu sebentar.")}`);
  const open = await one<{ id: number }>(
    `SELECT id FROM nokos.deposits WHERE user_id=$1 AND status='PENDING' AND amount=$2
       AND created_at > now() - interval '15 minutes' AND (expires_at IS NULL OR expires_at > now() + interval '2 minutes')
     ORDER BY id DESC LIMIT 1`, [u.id, amount]);
  if (open) redirect(`/deposit/${open.id}`);
  let id: number;
  try {
    id = (await createDeposit(u.id, amount)).id;
  } catch (err) {
    redirect(`/deposit?err=${encodeURIComponent(err instanceof ShopError ? err.message : "Gagal membuat tagihan.")}`);
  }
  redirect(`/deposit/${id}`);
}

export async function cancelDepositAction(f: FormData) {
  const u = await requireUser("/deposit");
  const id = Number(f.get("id"));
  let msg = "Tagihan dibatalkan.";
  try {
    const d = await cancelDeposit(u.id, id);
    if (d.status === "PAID") msg = "Tagihan ini ternyata sudah lunas, saldo sudah masuk.";
  } catch (err) {
    redirect(`/deposit/${id}?err=${encodeURIComponent(err instanceof ShopError ? err.message : "Gagal membatalkan.")}`);
  }
  redirect(`/deposit/${id}?ok=${encodeURIComponent(msg)}`);
}
