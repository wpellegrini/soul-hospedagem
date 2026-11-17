import type { Metadata } from "next";
import Link from "next/link";
import { getSettings, requireFront } from "@/lib/auth";
import { loadRoomMap, loadTotals } from "@/lib/queries";
import {
  addDays,
  formatDate,
  formatDayShort,
  formatMoney,
  formatTime,
  todayISO,
  type Reservation,
} from "@/lib/types";
import type { RoomSituation } from "@/lib/occupancy";
import RoomCard from "@/components/room-card";
import ActionForm from "@/components/action-form";
import { changeStatus } from "../reservas/actions";

export const metadata: Metadata = { title: "Painel" };

type StayRow = Pick<Reservation, "id" | "room_id" | "check_in" | "check_out" | "status" | "adults" | "children"> & {
  guest: { full_name: string; phone: string } | null;
  room: { number: string } | null;
};

export default async function DashboardPage() {
  const { supabase } = await requireFront();
  const settings = await getSettings();
  const today = todayISO();
  const horizon = addDays(today, 7);
  const monthStart = `${today.slice(0, 7)}-01T00:00:00-03:00`;

  const [states, { data: upcoming }, { data: monthPayments }] = await Promise.all([
    loadRoomMap(supabase, today),
    supabase
      .from("reservations")
      .select("id, room_id, check_in, check_out, status, adults, children, guest:guests(full_name, phone), room:rooms(number)")
      .in("status", ["confirmada", "hospedado"])
      .lt("check_in", horizon)
      .order("check_in")
      .returns<StayRow[]>(),
    supabase.from("payments").select("amount").gte("created_at", monthStart),
  ]);

  const stays = upcoming ?? [];
  const inHouse = stays.filter((r) => r.status === "hospedado");
  const arrivals = stays.filter((r) => r.status === "confirmada" && r.check_in <= today);
  const departures = inHouse.filter((r) => r.check_out <= today);
  const totals = await loadTotals(supabase, inHouse.map((r) => r.id));

  const sellable = states.filter((s) => s.housekeeping !== "manutencao" || s.stay).length;
  const occupied = states.filter((s) => ["ocupado", "saida", "atrasada"].includes(s.situation)).length;
  const occupancy = sellable ? Math.round((occupied / sellable) * 100) : 0;
  const free = states.filter((s) => s.situation === "livre").length;
  const toClean = states.filter((s) => s.housekeeping === "sujo").length;
  const guestsInHouse = inHouse.reduce((n, r) => n + r.adults + r.children, 0);
  const receivable = inHouse.reduce((sum, r) => sum + Math.max(0, Number(totals.get(r.id)?.balance ?? 0)), 0);
  const monthRevenue = (monthPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  // Ocupação prevista para os próximos 7 dias
  const forecast = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i);
    const n = stays.filter((r) => r.check_in <= day && r.check_out > day).length;
    return { day, n, pct: sellable ? Math.round((n / sellable) * 100) : 0 };
  });

  const counts = states.reduce(
    (acc, s) => ({ ...acc, [s.situation]: (acc[s.situation] ?? 0) + 1 }),
    {} as Partial<Record<RoomSituation, number>>,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Painel</h1>
          <p className="text-sm text-stone-500">
            Hoje, {formatDate(today)} · check-in a partir das {formatTime(settings.checkin_time)} · check-out até{" "}
            {formatTime(settings.checkout_time)}
          </p>
        </div>
        <Link href="/reservas/nova" className="btn-primary">
          + Nova reserva
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Ocupação hoje" value={`${occupancy}%`} hint={`${occupied} de ${sellable} quartos`} />
        <Kpi label="Quartos livres" value={free} href="/reservas/nova" />
        <Kpi label="Chegadas" value={arrivals.length} hint="hoje ou pendentes" />
        <Kpi label="Saídas" value={departures.length} tone={departures.some((d) => d.check_out < today) ? "danger" : undefined} />
        <Kpi label="Hóspedes na casa" value={guestsInHouse} />
        <Kpi label="Para limpar" value={toClean} href="/quartos?filtro=sujo" tone={toClean ? "warn" : undefined} />
        <Kpi label="A receber (na casa)" value={formatMoney(receivable)} />
        <Kpi label="Recebido no mês" value={formatMoney(monthRevenue)} />
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-stone-900">Mapa de quartos</h2>
          <Legend counts={counts} />
        </div>
        {states.length === 0 ? (
          <p className="card p-6 text-sm text-stone-500">
            Nenhum quarto cadastrado. Cadastre em <Link className="underline" href="/admin/quartos">Administração → Quartos</Link>.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {states.map((s) => (
              <RoomCard key={s.room.id} state={s} linkToStay />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold text-stone-900">
            Chegadas ({arrivals.length})
          </h2>
          {arrivals.length === 0 ? (
            <p className="px-4 py-6 text-sm text-stone-500">Nenhuma chegada prevista para hoje.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {arrivals.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <Link href={`/reservas/${r.id}`} className="min-w-0 hover:underline">
                    <div className="font-medium text-stone-900">{r.guest?.full_name}</div>
                    <div className="text-xs text-stone-500">
                      Quarto {r.room?.number} · {formatDate(r.check_in)} → {formatDate(r.check_out)}
                      {r.check_in < today && <span className="ml-1 font-medium text-orange-700">(atrasado)</span>}
                    </div>
                  </Link>
                  <ActionForm action={changeStatus} className="flex flex-col items-end">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="hospedado" />
                    <button className="btn-primary px-3 py-1.5 text-xs">Fazer check-in</button>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold text-stone-900">
            Saídas ({departures.length})
          </h2>
          {departures.length === 0 ? (
            <p className="px-4 py-6 text-sm text-stone-500">Nenhuma saída prevista para hoje.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {departures.map((r) => {
                const balance = Number(totals.get(r.id)?.balance ?? 0);
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="font-medium text-stone-900">{r.guest?.full_name}</div>
                      <div className="text-xs text-stone-500">
                        Quarto {r.room?.number} · saída {formatDate(r.check_out)}
                        {r.check_out < today && <span className="ml-1 font-medium text-red-700">(atrasada)</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${balance > 0 ? "text-red-700" : "text-emerald-700"}`}>
                        {balance > 0 ? `Deve ${formatMoney(balance)}` : "Conta paga"}
                      </span>
                      <Link href={`/reservas/${r.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                        Fechar conta
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-4">
        <h2 className="mb-4 text-sm font-semibold text-stone-900">Ocupação prevista (próximos 7 dias)</h2>
        <div className="grid grid-cols-7 gap-2">
          {forecast.map((f) => {
            const d = formatDayShort(f.day);
            return (
              <div key={f.day} className="flex flex-col items-center gap-1 text-xs">
                <div className="flex h-28 w-full max-w-12 items-end rounded bg-stone-100">
                  <div className="w-full rounded bg-brand-600" style={{ height: `${Math.min(100, f.pct)}%` }} />
                </div>
                <span className="font-semibold text-stone-800">{f.pct}%</span>
                <span className="text-stone-500">
                  {d.weekday} {d.day}/{d.month}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Legend({ counts }: { counts: Partial<Record<RoomSituation, number>> }) {
  const items: [RoomSituation, string, string][] = [
    ["livre", "Livre", "bg-emerald-400"],
    ["ocupado", "Ocupado", "bg-sky-400"],
    ["chegada", "Chegada", "bg-amber-400"],
    ["saida", "Saída hoje", "bg-violet-400"],
    ["atrasada", "Saída atrasada", "bg-red-400"],
    ["bloqueado", "Bloqueado", "bg-stone-400"],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
      {items.map(([key, label, dot]) => (
        <li key={key} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />
          {label} <span className="text-stone-400">({counts[key] ?? 0})</span>
        </li>
      ))}
    </ul>
  );
}

function Kpi({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  tone?: "danger" | "warn";
}) {
  const color = tone === "danger" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-stone-900";
  const body = (
    <>
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-stone-400">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 transition hover:border-stone-300">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}
