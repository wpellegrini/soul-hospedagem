import type { Metadata } from "next";
import Link from "next/link";
import { requireFront } from "@/lib/auth";
import {
  addDays,
  formatDate,
  formatMoney,
  isISODate,
  nightsBetween,
  todayISO,
  type Guest,
  type Room,
  type RoomType,
} from "@/lib/types";
import { HousekeepingBadge } from "@/components/badges";
import ReservationForm from "./reservation-form";

export const metadata: Metadata = { title: "Nova reserva" };

type RoomRow = Room & { room_type: RoomType };

function param(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : (v ?? "");
}

export default async function NewReservationPage({ searchParams }: PageProps<"/reservas/nova">) {
  const { supabase } = await requireFront();
  const sp = await searchParams;
  const today = todayISO();

  const checkIn = isISODate(param(sp.entrada)) && param(sp.entrada) >= today ? param(sp.entrada) : today;
  const checkOutRaw = param(sp.saida);
  const checkOut = isISODate(checkOutRaw) && checkOutRaw > checkIn ? checkOutRaw : addDays(checkIn, 1);
  const people = Math.max(1, Number(param(sp.pessoas)) || 1);
  const roomId = Number(param(sp.quarto)) || null;
  const n = nightsBetween(checkIn, checkOut);

  const [{ data: rooms }, { data: busy }] = await Promise.all([
    supabase
      .from("rooms")
      .select("*, room_type:room_types!inner(*)")
      .eq("active", true)
      .eq("room_type.active", true)
      .order("number")
      .returns<RoomRow[]>(),
    supabase
      .from("reservations")
      .select("room_id")
      .in("status", ["confirmada", "hospedado"])
      .lt("check_in", checkOut)
      .gt("check_out", checkIn),
  ]);

  const busyIds = new Set((busy ?? []).map((b) => b.room_id as number));
  const available = (rooms ?? []).filter(
    (r) => !busyIds.has(r.id) && r.housekeeping !== "manutencao" && r.room_type.capacity >= people,
  );
  const selected = roomId ? (rooms ?? []).find((r) => r.id === roomId) : undefined;
  const selectedFree = selected && !busyIds.has(selected.id);

  let guests: Pick<Guest, "id" | "full_name" | "document" | "phone">[] = [];
  if (selected) {
    const { data } = await supabase
      .from("guests")
      .select("id, full_name, document, phone")
      .order("full_name")
      .limit(1000);
    guests = data ?? [];
  }

  const qs = (extra: Record<string, string | number>) =>
    new URLSearchParams({ entrada: checkIn, saida: checkOut, pessoas: String(people), ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) }).toString();

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/reservas" className="text-sm text-stone-500 hover:text-stone-800">
        ← Reservas
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-stone-900">Nova reserva</h1>

      <form className="card mb-6 grid gap-4 p-4 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
        <div>
          <label htmlFor="entrada" className="label">Entrada</label>
          <input id="entrada" type="date" name="entrada" min={today} defaultValue={checkIn} className="input" required />
        </div>
        <div>
          <label htmlFor="saida" className="label">Saída</label>
          <input id="saida" type="date" name="saida" min={addDays(today, 1)} defaultValue={checkOut} className="input" required />
        </div>
        <div>
          <label htmlFor="pessoas" className="label">Pessoas</label>
          <input id="pessoas" type="number" name="pessoas" min={1} max={20} defaultValue={people} className="input" />
        </div>
        <button className="btn-primary">Ver disponibilidade</button>
      </form>

      {selected ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section className="card p-5">
            {!selectedFree && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                Atenção: o quarto {selected.number} já tem reserva em parte desse período.
              </p>
            )}
            <ReservationForm
              roomId={selected.id}
              checkIn={checkIn}
              checkOut={checkOut}
              people={people}
              baseRate={Number(selected.room_type.base_rate)}
              capacity={selected.room_type.capacity}
              canCheckInNow={checkIn === today && selected.housekeeping === "limpo"}
              guests={guests}
            />
          </section>
          <aside className="card h-fit p-5 text-sm">
            <h2 className="mb-3 font-semibold text-stone-900">Resumo</h2>
            <dl className="space-y-2">
              <Item label="Quarto" value={`${selected.number} · ${selected.room_type.name}`} />
              <Item label="Período" value={`${formatDate(checkIn)} → ${formatDate(checkOut)}`} />
              <Item label="Noites" value={String(n)} />
              <Item label="Diária padrão" value={formatMoney(selected.room_type.base_rate)} />
              <Item label="Estimativa" value={formatMoney(n * Number(selected.room_type.base_rate))} />
              <Item label="Capacidade" value={`até ${selected.room_type.capacity} pessoa(s)`} />
            </dl>
            <Link href={`/reservas/nova?${qs({})}`} className="mt-4 inline-block text-sm text-emerald-700 hover:underline">
              Trocar de quarto
            </Link>
          </aside>
        </div>
      ) : (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-stone-900">
            {available.length} {available.length === 1 ? "quarto disponível" : "quartos disponíveis"} ·{" "}
            {formatDate(checkIn)} → {formatDate(checkOut)} ({n} {n === 1 ? "noite" : "noites"})
          </h2>
          {available.length === 0 ? (
            <p className="card p-6 text-sm text-stone-500">
              Nenhum quarto livre para esse período e número de pessoas. Tente outras datas.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((r) => (
                <div key={r.id} className="card flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-lg font-semibold text-stone-900">Quarto {r.number}</div>
                      <div className="text-xs text-stone-500">
                        {r.room_type.name} · até {r.room_type.capacity} pessoa(s) {r.floor && `· ${r.floor}`}
                      </div>
                    </div>
                    <HousekeepingBadge value={r.housekeeping} />
                  </div>
                  {r.room_type.description && <p className="mt-2 text-xs text-stone-500">{r.room_type.description}</p>}
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <div className="text-xs text-stone-500">{formatMoney(r.room_type.base_rate)} / diária</div>
                      <div className="font-semibold text-stone-900">{formatMoney(n * Number(r.room_type.base_rate))}</div>
                    </div>
                    <Link href={`/reservas/nova?${qs({ quarto: r.id })}`} className="btn-primary px-3 py-1.5">
                      Reservar
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-stone-800">{value}</dd>
    </div>
  );
}
