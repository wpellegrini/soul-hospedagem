import type { Metadata } from "next";
import Link from "next/link";
import { requireFront } from "@/lib/auth";
import { loadTotals } from "@/lib/queries";
import {
  ACTIVE_STATUSES,
  formatDate,
  formatMoney,
  isISODate,
  nightsBetween,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  type Reservation,
  type ReservationStatus,
} from "@/lib/types";
import { StatusBadge } from "@/components/badges";

export const metadata: Metadata = { title: "Reservas" };

type Row = Reservation & {
  guest: { full_name: string; phone: string };
  room: { number: string } | null;
};

function param(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : (v ?? "");
}

export default async function ReservationsPage({ searchParams }: PageProps<"/reservas">) {
  const { supabase } = await requireFront();
  const sp = await searchParams;
  const status = param(sp.situacao) || "ativas";
  const q = param(sp.q).trim();
  const from = param(sp.de);
  const to = param(sp.ate);

  let query = supabase
    .from("reservations")
    .select("*, guest:guests!inner(full_name, phone), room:rooms(number)")
    .order("check_in", { ascending: status === "ativas" })
    .limit(300);

  if (status === "ativas") query = query.in("status", ACTIVE_STATUSES);
  else if (STATUS_ORDER.includes(status as ReservationStatus)) query = query.eq("status", status);
  if (isISODate(from)) query = query.gte("check_out", from);
  if (isISODate(to)) query = query.lte("check_in", to);
  if (q) {
    const asNumber = Number(q.replace("#", ""));
    query =
      Number.isInteger(asNumber) && asNumber > 0 && q.length <= 7
        ? query.eq("id", asNumber)
        : query.ilike("guest.full_name", `%${q}%`);
  }

  const { data, error } = await query.returns<Row[]>();
  const rows = data ?? [];
  const totals = await loadTotals(supabase, rows.map((r) => r.id));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Reservas</h1>
          <p className="text-sm text-stone-500">
            {rows.length} {rows.length === 1 ? "reserva" : "reservas"}
          </p>
        </div>
        <Link href="/reservas/nova" className="btn-primary">
          + Nova reserva
        </Link>
      </div>

      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_10rem_10rem_auto]">
        <input name="q" defaultValue={q} placeholder="Nome do hóspede ou nº da reserva" className="input" aria-label="Buscar" />
        <select name="situacao" defaultValue={status} className="input" aria-label="Situação">
          <option value="ativas">Ativas (confirmadas e hospedados)</option>
          <option value="todas">Todas</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input type="date" name="de" defaultValue={from} className="input" aria-label="A partir de" />
        <input type="date" name="ate" defaultValue={to} className="input" aria-label="Até" />
        <button className="btn-secondary">Filtrar</button>
      </form>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error.message}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-stone-200 text-left text-xs text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Hóspede</th>
              <th className="px-4 py-2 font-medium">Quarto</th>
              <th className="px-4 py-2 font-medium">Entrada → Saída</th>
              <th className="px-4 py-2 font-medium">Origem</th>
              <th className="px-4 py-2 font-medium">Situação</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                  Nenhuma reserva encontrada.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const t = totals.get(r.id);
              const total = Number(t?.lodging_total ?? 0) + Number(t?.charges_total ?? 0);
              const balance = Number(t?.balance ?? 0);
              const n = nightsBetween(r.check_in, r.check_out);
              return (
                <tr key={r.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-stone-500">
                    <Link href={`/reservas/${r.id}`} className="hover:underline">
                      {r.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/reservas/${r.id}`} className="font-medium text-stone-900 hover:underline">
                      {r.guest.full_name}
                    </Link>
                    <div className="text-xs text-stone-500">
                      {r.adults + r.children} pessoa(s)
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{r.room?.number}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(r.check_in)} → {formatDate(r.check_out)}
                    <div className="text-xs text-stone-500">{n} {n === 1 ? "noite" : "noites"}</div>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{SOURCE_LABEL[r.source] ?? r.source}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatMoney(total)}</td>
                  <td
                    className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                      balance > 0 && ACTIVE_STATUSES.includes(r.status) ? "text-red-700" : "text-stone-500"
                    }`}
                  >
                    {formatMoney(balance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
