import "server-only";
import crypto from "node:crypto";
import { config } from "./config";

/** Client payment gateway Sakupay (QRIS). Dokumentasi: https://sakupay.site/docs */
export class SakupayError extends Error {
  constructor(public code: string, message = "", public status?: number) {
    super(`${code}: ${message}`);
  }
}

export type SpPayment = {
  id: string; amount: number; payable_amount: number; fee_amount?: number; status: string; mode: string;
  reference?: string; payment_url?: string; qr_string?: string; expires_at?: string; paid_at?: string | null;
};

async function req<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(config.sakupayBase.replace(/\/$/, "") + path, {
      method,
      headers: {
        Authorization: `Bearer ${config.sakupayKey}`, Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000), cache: "no-store",
    });
  } catch (err) {
    throw new SakupayError("NETWORK", (err as Error).message);
  }
  let json: { data?: T; error?: { code?: string; message?: string } };
  try {
    json = await res.json();
  } catch {
    throw new SakupayError("BAD_RESPONSE", `HTTP ${res.status}`, res.status);
  }
  if (!res.ok || json.error) throw new SakupayError(json.error?.code ?? `HTTP_${res.status}`, json.error?.message ?? "", res.status);
  return json.data as T;
}

export const sakupay = {
  enabled: () => Boolean(config.sakupayKey),
  createPayment: (amount: number, reference: string, idempotencyKey: string) =>
    req<SpPayment>("POST", "/payments", {
      amount, reference,
      ...(["MERCHANT", "BUYER"].includes(config.sakupayFeeBearer) ? { fee_bearer: config.sakupayFeeBearer } : {}),
    }, { "Idempotency-Key": idempotencyKey }),
  payment: (id: string) => req<SpPayment>("GET", `/payments/${encodeURIComponent(id)}`),
  cancel: (id: string) => req<{ status: string }>("POST", `/payments/${encodeURIComponent(id)}/cancel`),
  balance: () => req<{ balance: number; held: number; available: number; test_balance: number }>("GET", "/balance"),
  getWebhook: () => req<{ url?: string | null; has_secret?: boolean; events?: string[] }>("GET", "/webhook"),
  /** Mendaftarkan URL webhook. Secret baru dikembalikan sekali ini saja; secret lama langsung tidak berlaku. */
  setWebhook: (url: string) => req<{ url: string; secret: string }>("POST", "/webhook", { url }),
};

/** HMAC-SHA256(secret, `${timestamp}.${rawBody}`) dalam hex, dibandingkan timing-safe. */
export function verifySignature(secret: string, timestamp: string, rawBody: string, signature: string) {
  if (!secret || !timestamp || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const normStatus = (s?: string | null) => {
  const up = (s ?? "").toUpperCase();
  return up === "CANCELED" ? "CANCELLED" : up;
};
