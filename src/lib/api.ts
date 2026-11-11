import "server-only";
import { NextResponse } from "next/server";
import { getUser } from "./auth";
import { ShopError } from "./shop";
import { SmsCodeError } from "./smscode";

export class ApiError extends Error {
  constructor(message: string, public status = 400, public code = "ERROR", public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export async function apiUser() {
  const u = await getUser();
  if (!u) throw new ApiError("Silakan masuk dulu.", 401, "LOGIN");
  return u;
}

/** Tolak POST dari website lain (perlindungan CSRF untuk API JSON). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) throw new ApiError("Permintaan ditolak.", 403, "ORIGIN");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new Error();
  } catch {
    throw new ApiError("Permintaan ditolak.", 403, "ORIGIN");
  }
}

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const data = await fn(...args);
      return data instanceof Response ? data : NextResponse.json(data);
    } catch (err) {
      if (err instanceof ApiError) return NextResponse.json({ error: err.message, code: err.code, ...err.extra }, { status: err.status });
      if (err instanceof ShopError) return NextResponse.json({ error: err.message, code: err.code, ...err.extra }, { status: 400 });
      if (err instanceof SmsCodeError) {
        console.warn("[api] smscode:", err.message);
        return NextResponse.json({ error: "Server nomor sedang sibuk. Coba lagi sebentar.", code: err.code }, { status: 503 });
      }
      console.error("[api]", err);
      return NextResponse.json({ error: "Terjadi kesalahan. Coba lagi.", code: "INTERNAL" }, { status: 500 });
    }
  };
}
