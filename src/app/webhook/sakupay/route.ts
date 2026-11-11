import { NextResponse } from "next/server";
import { config, sakupayTest } from "@/lib/config";
import { getSetting, one, type Deposit } from "@/lib/db";
import { verifySignature } from "@/lib/sakupay";
import { syncDeposit } from "@/lib/shop";

export const dynamic = "force-dynamic";

/** Webhook payment.paid dari Sakupay. Saldo baru ditambah setelah status dikonfirmasi ulang lewat API. */
export async function POST(req: Request) {
  const raw = await req.text();
  const ts = req.headers.get("x-sakupay-timestamp") ?? "";
  const sig = req.headers.get("x-sakupay-signature") ?? "";
  const secret = (await getSetting("sakupay_webhook_secret")) || config.sakupayWebhookSecret;
  if (!verifySignature(secret, ts, raw, sig)) {
    console.warn("[webhook] signature Sakupay tidak valid");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let ev: { event?: string; paymentId?: string; reference?: string; mode?: string };
  try {
    ev = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (ev.event !== "payment.paid") return NextResponse.json({ ok: true, ignored: "event" });
  if ((ev.mode === "TEST") !== sakupayTest()) return NextResponse.json({ ok: true, ignored: "mode" });

  let d = await one<Deposit>("SELECT * FROM nokos.deposits WHERE sp_id = $1", [ev.paymentId ?? ""]);
  if (!d) return NextResponse.json({ ok: true, ignored: "unknown payment" });
  if (d.status === "PAID") return NextResponse.json({ ok: true });

  d = await syncDeposit(d);
  if (d.status !== "PAID") return NextResponse.json({ error: "belum terkonfirmasi, coba lagi" }, { status: 503 });
  return NextResponse.json({ ok: true });
}
