import { apiUser, handle, sameOrigin } from "@/lib/api";
import { one } from "@/lib/db";
import { orderAction, orderJson } from "@/lib/shop";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string; aksi: string }> }) => {
  sameOrigin(req);
  const u = await apiUser();
  const { id, aksi } = await ctx.params;
  const { order, message } = await orderAction(u.id, Number(id), aksi);
  const bal = await one<{ balance: number }>("SELECT balance FROM nokos.users WHERE id = $1", [u.id]);
  return { order: orderJson(order), message, balance: bal?.balance ?? 0 };
});
