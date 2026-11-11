import { ApiError, apiUser, handle } from "@/lib/api";
import { quote } from "@/lib/shop";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const u = await apiUser();
  const sp = new URL(req.url).searchParams;
  const negara = Number(sp.get("negara"));
  const layanan = Number(sp.get("layanan"));
  if (!negara || !layanan) throw new ApiError("Pilih negara dan layanan.");
  const q = await quote(negara, layanan);
  if (!q) return { available: false, balance: u.balance };
  return { available: true, price: q.price, stock: q.stock, balance: u.balance };
});
