import { ApiError, apiUser, handle } from "@/lib/api";
import { one } from "@/lib/db";
import { statusLabel } from "@/lib/format";
import { rateLimited } from "@/lib/ratelimit";
import { getDeposit, syncDeposit } from "@/lib/shop";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const u = await apiUser();
  const id = Number((await ctx.params).id);
  let d = await getDeposit(id);
  if (!d || d.user_id !== u.id) throw new ApiError("Tagihan tidak ditemukan.", 404);
  if (d.status === "PENDING" && !rateLimited(`depcheck:${id}`, 1, 4)) d = await syncDeposit(d);
  const bal = await one<{ balance: number }>("SELECT balance FROM nokos.users WHERE id = $1", [u.id]);
  return { status: d.status, label: statusLabel(d.status), balance: bal?.balance ?? 0 };
});
