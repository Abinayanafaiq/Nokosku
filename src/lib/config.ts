import "server-only";

const e = (k: string, d = "") => (process.env[k] ?? d).trim();
const n = (k: string, d: number) => {
  const v = Number(e(k, String(d)));
  return Number.isFinite(v) ? v : d;
};

export const config = {
  siteName: e("SITE_NAME", "NokosKu"),
  /** Alamat publik website, contoh https://nokosku.com (dipakai untuk webhook Sakupay). */
  siteUrl: e("SITE_URL").replace(/\/$/, ""),
  contactUrl: e("CONTACT_URL"),
  contactLabel: e("CONTACT_LABEL", "Hubungi CS"),

  databaseUrl: e("DATABASE_URL"),
  databaseSsl: ["1", "true", "yes"].includes(e("DATABASE_SSL").toLowerCase()),

  smscodeToken: e("SMSCODE_API_TOKEN"),
  smscodeBase: e("SMSCODE_BASE_URL", "https://api.smscode.gg/v1"),

  sakupayKey: e("SAKUPAY_API_KEY"),
  sakupayBase: e("SAKUPAY_BASE_URL", "https://sakupay.site/api/v1"),
  sakupayWebhookSecret: e("SAKUPAY_WEBHOOK_SECRET"),
  /** MERCHANT = fee kamu yang tanggung, BUYER = pembeli, kosong = setelan akun Sakupay */
  sakupayFeeBearer: e("SAKUPAY_FEE_BEARER").toUpperCase(),

  adminEmails: new Set(
    e("ADMIN_EMAILS")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ),

  depositMin: n("DEPOSIT_MIN", 10000),
  depositMax: n("DEPOSIT_MAX", 5000000),
  markupPercent: n("MARKUP_PERCENT", 50),
  markupMin: n("MARKUP_MIN", 1000),
  /** true kalau website diakses lewat https (domain + Cloudflare) */
  cookieSecure: ["1", "true", "yes"].includes(e("COOKIE_SECURE").toLowerCase()),
};

export const sakupayTest = () => config.sakupayKey.startsWith("sk_test_");
