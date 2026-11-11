import "server-only";
import { cleanupSessions } from "./auth";
import { ensureSchema } from "./db";
import { countries, pollDeposits, pollOrders } from "./shop";

const g = globalThis as unknown as { __nokosWorkers?: boolean };

function loop(name: string, everyMs: number, fn: () => Promise<unknown>) {
  const run = async () => {
    try {
      await fn();
    } catch (err) {
      console.warn(`[${name}] ${(err as Error).message}`);
    }
    setTimeout(run, everyMs);
  };
  setTimeout(run, 3000);
}

/** Dipanggil sekali saat server Next.js menyala (lihat src/instrumentation.ts). */
export function startWorkers() {
  if (g.__nokosWorkers) return;
  g.__nokosWorkers = true;
  ensureSchema()
    .then(() => console.log("[db] tabel schema nokos siap"))
    .catch((err) => console.error("[db] GAGAL konek database — cek DATABASE_URL di .env:", err.message));
  countries().catch((err) => console.error("[smscode] GAGAL ambil katalog — cek SMSCODE_API_TOKEN di .env:", err.message));
  loop("cek-otp", 4000, pollOrders);
  loop("cek-deposit", 8000, pollDeposits);
  loop("bersih-sesi", 3600_000, cleanupSessions);
  console.log("[nokos] pekerja latar belakang jalan (cek OTP tiap 4 dtk, cek deposit tiap 8 dtk)");
}
