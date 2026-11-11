import { ApiError, apiUser, handle, sameOrigin } from "@/lib/api";
import { one } from "@/lib/db";
import { rateLimited } from "@/lib/ratelimit";
import { buy, orderJson } from "@/lib/shop";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  sameOrigin(req);
  const u = await apiUser();
  let body: { negara?: unknown; layanan?: unknown; harga?: unknown };
  try {
    body = await req.json();
  } catch {
    throw new ApiError("Permintaan tidak valid.");
  }
  const cid = Number(body.negara), pid = Number(body.layanan), price = Number(body.harga);
  if (!cid || !pid || !price) throw new ApiError("Permintaan tidak valid.");
  if (rateLimited(`buy:${u.id}`, 20, 60)) throw new ApiError("Terlalu cepat. Tunggu sebentar.", 429, "SLOW_DOWN");
  const o = await buy(u.id, cid, pid, price);
  const bal = await one<{ balance: number }>("SELECT balance FROM nokos.users WHERE id = $1", [u.id]);
  return { order: orderJson(o), balance: bal?.balance ?? 0 };
});
