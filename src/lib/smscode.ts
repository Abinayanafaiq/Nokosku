import "server-only";
import crypto from "node:crypto";
import { config } from "./config";

/** Client API smscode.gg v1 (semua harga dalam Rupiah). */
export class SmsCodeError extends Error {
  constructor(public code: string, message = "", public status?: number) {
    super(`${code}: ${message}`);
  }
}

export type ScCountry = { id: number; code: string; name: string; dial_code: string; emoji: string; active: boolean };
export type ScService = { id: number; code: string; name: string; active: boolean };
export type ScProduct = {
  id: number; name: string; country_id: number; platform_id: number; available: number; price: number;
  active: boolean; catalog_product_id: number | null;
};
export type ScOrder = {
  id: number; status: string; phone_number?: string | null; amount?: number; otp_code?: string | null;
  otp_message?: string | null; sms_revision?: number | null; expires_at?: string | null;
  cancel_available_at?: string | null; can_resend?: boolean; can_cancel?: boolean;
};

async function req<T>(method: string, path: string,
  opts: { query?: Record<string, unknown>; body?: unknown; idem?: string; timeoutMs?: number } = {}): Promise<T> {
  const url = new URL(config.smscodeBase.replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { Authorization: `Bearer ${config.smscodeToken}`, Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.idem) headers["Idempotency-Key"] = opts.idem;
  let res: Response;
  try {
    res = await fetch(url, {
      method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000), cache: "no-store",
    });
  } catch (err) {
    throw new SmsCodeError("NETWORK", (err as Error).message);
  }
  let body: { success?: boolean; data?: T; error?: { code?: string; message?: string } };
  try {
    body = await res.json();
  } catch (err) {
    // respons terpotong / timeout di tengah jalan
    throw new SmsCodeError(res.ok ? "NETWORK" : "BAD_RESPONSE", `HTTP ${res.status} ${(err as Error).message}`, res.status);
  }
  if (!body.success) throw new SmsCodeError(body.error?.code ?? "UNKNOWN", body.error?.message ?? "", res.status);
  return body.data as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const smscode = {
  countries: () => req<ScCountry[]>("GET", "/catalog/countries", { timeoutMs: 45_000 }),
  services: (countryId: number) => req<ScService[]>("GET", "/catalog/services", { query: { country_id: countryId }, timeoutMs: 45_000 }),
  products: (countryId: number, platformId: number) =>
    req<ScProduct[]>("GET", "/catalog/products", {
      // Diurutkan termurah dulu; 40 penawaran teratas sudah cukup. Limit besar membuat API lambat sekali.
      query: { country_id: countryId, platform_id: platformId, sort: "price_asc", limit: 40 },
    }),
  balance: async () => (await req<{ balance: number }>("GET", "/balance")).balance,

  /** Beli 1 nomor. Aman di-retry karena memakai Idempotency-Key yang sama. */
  async createOrder(o: { catalogProductId?: number | null; productId?: number; maxPrice?: number; policy?: "cheapest" | "best_success" }) {
    const body = o.catalogProductId
      ? { catalog_product_id: o.catalogProductId, policy: o.policy ?? "cheapest", quantity: 1, ...(o.maxPrice ? { max_price: o.maxPrice } : {}) }
      : { product_id: o.productId, quantity: 1 };
    const key = `nk-${crypto.randomUUID()}`;
    let last: SmsCodeError | null = null;
    for (let i = 0; i < 4; i++) {
      try {
        return await req<{ orders: ScOrder[]; failed_count: number }>("POST", "/orders/create", { body, idem: key });
      } catch (err) {
        last = err as SmsCodeError;
        if (["NETWORK", "REQUEST_IN_PROGRESS", "INTERNAL_ERROR"].includes(last.code)) {
          await sleep(1500 * (i + 1));
          continue;
        }
        throw err;
      }
    }
    throw last;
  },
  order: (id: number) => req<ScOrder>("GET", `/orders/${id}`),
  activeOrders: () => req<ScOrder[]>("GET", "/orders/active"),
  cancel: (id: number) => req<{ refund_amount: number }>("POST", "/orders/cancel", { body: { id } }),
  finish: (id: number) => req<{ status: string }>("POST", "/orders/finish", { body: { id } }),
  resend: (id: number) => req<{ resent: boolean }>("POST", "/orders/resend", { body: { id } }),
};
