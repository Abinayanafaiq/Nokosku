import { apiUser, handle } from "@/lib/api";
import { q, type Order } from "@/lib/db";
import { orderJson } from "@/lib/shop";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const u = await apiUser();
  const rows = await q<Order>(
    `SELECT * FROM nokos.orders WHERE user_id = $1 AND sc_id IS NOT NULL
       AND (status IN ('ACTIVE','OTP_RECEIVED') OR updated_at > now() - interval '30 minutes')
     ORDER BY id DESC LIMIT 20`, [u.id]);
  return { orders: rows.map(orderJson), balance: u.balance };
});
