import { addRule, deleteRule, saveGlobalMarkup } from "../actions";
import { Notice, one as first, PageTitle } from "@/components/Notice";
import { SubmitButton } from "@/components/ui";
import { rp } from "@/lib/format";
import { countries, findRule, globalMarkup, markupPrice, offer, priceRules, sellPrice, services } from "@/lib/shop";

export const metadata = { title: "Harga" };

export default async function AdminPrices({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const [list, rules, gm] = await Promise.all([countries().catch(() => []), priceRules(), globalMarkup()]);
  const idn = list.find((c) => c.code === "ID") ?? list[0];
  const svc = idn ? await services(idn.id).catch(() => []) : [];
  const apiDown = !list.length || !svc.length;

  // Cek harga
  const cekNegara = Number(first(sp.cek_negara)) || idn?.id || 0;
  const cekLayanan = first(sp.cek_layanan) ?? "";
  let check: null | { missing: true } | { service: string; country: string; cost: number | null; stock: number; price: number | null; rule: string } = null;
  if (cekNegara && cekLayanan) {
    const s = (await services(cekNegara).catch(() => [])).find((x) => x.code === cekLayanan);
    const c = list.find((x) => x.id === cekNegara);
    if (!s) check = { missing: true };
    else {
      const o = await offer(cekNegara, s.id, true).catch(() => null);
      const r = await findRule(s.code, cekNegara);
      check = {
        service: s.name, country: c ? `${c.emoji} ${c.name}` : String(cekNegara), cost: o?.cost ?? null, stock: o?.stock ?? 0,
        price: o ? await sellPrice(o.cost, s.code, cekNegara) : null,
        rule: r ? (r.mode === "fixed" ? `harga pas ${rp(r.fixed)}` : `markup +${r.pct}% min ${rp(r.min_profit)}`) : "markup global",
      };
    }
  }

  const input = "w-full rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-ink-2";
  return (
    <>
      <PageTitle title="Harga" sub="Harga jual dihitung otomatis dari harga modal smscode.gg saat itu." />
      <Notice err={first(sp.err)} ok={first(sp.ok)} />
      {apiDown && <div className="mt-3"><Notice err="Katalog smscode.gg sedang tidak bisa diambil, daftar negara/layanan mungkin kosong. Muat ulang sebentar lagi." /></div>}

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-bold">Markup global</h2>
          <p className="mt-1 text-sm text-ink-2">Dipakai semua layanan yang tidak punya aturan khusus. Harga jual = yang lebih besar antara modal + persen dan modal + minimal untung, dibulatkan ke atas ke Rp100.</p>
          <form action={saveGlobalMarkup} className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-sm font-bold">Markup (%)<input name="pct" defaultValue={gm.pct} inputMode="decimal" className={`${input} mt-1`} /></label>
            <label className="text-sm font-bold">Minimal untung (Rp)<input name="min" defaultValue={gm.min} inputMode="numeric" className={`${input} mt-1`} /></label>
            <SubmitButton className="col-span-2" pendingText="Menyimpan…">Simpan markup</SubmitButton>
          </form>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-ink-2"><tr><th className="py-1 font-semibold">Modal</th><th className="py-1 text-right font-semibold">Jual</th><th className="py-1 text-right font-semibold">Untung</th></tr></thead>
            <tbody>
              {[150, 900, 1900, 5000].map((c) => {
                const p = markupPrice(c, gm.pct, gm.min);
                return <tr key={c} className="border-t border-line"><td className="tabular py-1.5">{rp(c)}</td><td className="tabular py-1.5 text-right font-bold">{rp(p)}</td><td className="tabular py-1.5 text-right text-signal">{rp(p - c)}</td></tr>;
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-bold">Cek harga sebuah layanan</h2>
          <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <select name="cek_negara" defaultValue={cekNegara} className={input}>
              {list.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
            <input name="cek_layanan" defaultValue={cekLayanan} list="svc-codes" placeholder="kode layanan, contoh whatsapp" className={input} />
            <button className="rounded-xl bg-ink px-4 py-2.5 font-bold text-paper">Cek</button>
          </form>
          {check && ("missing" in check ? (
            <p className="mt-4 text-sm text-danger">Layanan tidak ada di negara itu.</p>
          ) : (
            <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-ink-2">Layanan</dt><dd className="text-right font-bold">{check.service} · {check.country}</dd>
              <dt className="text-ink-2">Modal termurah</dt><dd className="tabular text-right">{check.cost ? rp(check.cost) : "stok kosong"}</dd>
              <dt className="text-ink-2">Stok</dt><dd className="tabular text-right">{check.stock.toLocaleString("id-ID")}</dd>
              <dt className="text-ink-2">Harga jual</dt><dd className="tabular text-right font-display text-lg font-bold">{check.price ? rp(check.price) : "-"}</dd>
              <dt className="text-ink-2">Aturan dipakai</dt><dd className="text-right">{check.rule}</dd>
            </dl>
          ))}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-bold">Aturan harga per layanan</h2>
        <p className="mt-1 text-sm text-ink-2">
          Aturan untuk negara tertentu menang dari aturan &quot;semua negara&quot;. Harga pas yang lebih murah dari modal + Rp100 otomatis diabaikan supaya tidak rugi.
        </p>
        <form action={addRule} className="mt-4 grid gap-3 md:grid-cols-6">
          <label className="text-sm font-bold md:col-span-2">Layanan
            <input name="service_code" list="svc-codes" required placeholder="whatsapp" className={`${input} mt-1`} />
          </label>
          <label className="text-sm font-bold md:col-span-2">Negara
            <select name="country_id" defaultValue="" className={`${input} mt-1`}>
              <option value="">Semua negara</option>
              {list.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold md:col-span-2">Jenis
            <select name="mode" defaultValue="fixed" className={`${input} mt-1`}>
              <option value="fixed">Harga pas</option>
              <option value="markup">Markup khusus</option>
            </select>
          </label>
          <label className="text-sm font-bold md:col-span-2">Harga pas (Rp)
            <input name="fixed" inputMode="numeric" placeholder="3500" className={`${input} mt-1`} />
          </label>
          <label className="text-sm font-bold">Markup (%)
            <input name="pct" inputMode="decimal" placeholder="30" className={`${input} mt-1`} />
          </label>
          <label className="text-sm font-bold">Min. untung
            <input name="min_profit" inputMode="numeric" placeholder="500" className={`${input} mt-1`} />
          </label>
          <SubmitButton className="self-end md:col-span-2" pendingText="Menyimpan…">Simpan aturan</SubmitButton>
        </form>
        <p className="mt-2 text-xs text-ink-2">Isi &quot;Harga pas&quot; kalau jenisnya harga pas, atau isi Markup + Min. untung kalau jenisnya markup khusus.</p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-ink-2"><tr className="border-b border-line">
              <th className="py-2 font-semibold">Layanan</th><th className="py-2 font-semibold">Negara</th>
              <th className="py-2 font-semibold">Aturan</th><th /></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="py-2 font-bold">{r.service_name ?? r.service_code}</td>
                  <td className="py-2">{r.country_name ?? "Semua negara"}</td>
                  <td className="tabular py-2">{r.mode === "fixed" ? `Harga pas ${rp(r.fixed)}` : `+${r.pct}%, min untung ${rp(r.min_profit)}`}</td>
                  <td className="py-2 text-right">
                    <form action={deleteRule}><input type="hidden" name="id" value={r.id} />
                      <button className="rounded-lg px-2 py-1 text-xs font-bold text-danger hover:bg-danger/10">Hapus</button></form>
                  </td>
                </tr>
              ))}
              {!rules.length && <tr><td colSpan={4} className="py-5 text-center text-ink-2">Belum ada aturan khusus. Semua layanan memakai markup global.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <datalist id="svc-codes">
        {svc.map((s) => <option key={s.id} value={s.code}>{s.name}</option>)}
      </datalist>
    </>
  );
}
