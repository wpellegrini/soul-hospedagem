import type { Metadata } from "next";
import Link from "next/link";
import { requireFront } from "@/lib/auth";
import { addDays, formatDate, formatDayShort, isISODate, todayISO, type Reservation, type Room } from "@/lib/types";

export const metadata: Metadata = { title: "Agenda" };

const DAYS = 14;

type Row = Pick<Reservation, "id" | "room_id" | "check_in" | "check_out" | "status"> & {
  guest: { full_name: string } | null;
};

const CELL: Record<string, string> = {
  confirmada: "bg-sky-100 text-sky-900 hover:bg-sky-200",
  hospedado: "bg-emerald-200 text-emerald-950 hover:bg-emerald-300",
  finalizada: "bg-stone-200 text-stone-600 hover:bg-stone-300",
};

function param(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : (v ?? "");
}

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const { supabase } = await requireFront();
  const sp = await searchParams;
  const today = todayISO();
  const start = isISODate(param(sp.inicio)) ? param(sp.inicio) : today;
  const end = addDays(start, DAYS);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));

  const [{ data: rooms }, { data: reservations }] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, number, housekeeping, room_type:room_types(name)")
      .eq("active", true)
      .order("number")
      .returns<(Pick<Room, "id" | "number" | "housekeeping"> & { room_type: { name: string } | null })[]>(),
    supabase
      .from("reservations")
      .select("id, room_id, check_in, check_out, status, guest:guests(full_name)")
      .in("status", ["confirmada", "hospedado", "finalizada"])
      .lt("check_in", end)
      .gt("check_out", start)
      .returns<Row[]>(),
  ]);

  const byRoom = new Map<number, Row[]>();
  for (const r of reservations ?? []) byRoom.set(r.room_id, [...(byRoom.get(r.room_id) ?? []), r]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Agenda de ocupação</h1>
          <p className="text-sm text-stone-500">
            {formatDate(start)} a {formatDate(addDays(end, -1))} · clique num dia livre para reservar
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/agenda?inicio=${addDays(start, -7)}`} className="btn-secondary px-3">
            ← 7 dias
          </Link>
          <Link href="/agenda" className="btn-secondary px-3">
            Hoje
          </Link>
          <Link href={`/agenda?inicio=${addDays(start, 7)}`} className="btn-secondary px-3">
            7 dias →
          </Link>
          <form className="flex items-center gap-2">
            <input type="date" name="inicio" defaultValue={start} className="input w-40" aria-label="Começar em" />
            <button className="btn-secondary px-3">Ir</button>
          </form>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-28 border-b border-r border-stone-200 bg-white px-3 py-2 text-left font-semibold text-stone-700">
                Quarto
              </th>
              {days.map((day) => {
                const d = formatDayShort(day);
                const weekend = ["sáb", "dom"].includes(d.weekday);
                return (
                  <th
                    key={day}
                    className={`border-b border-stone-200 px-1 py-2 text-center font-medium ${
                      day === today ? "bg-amber-50 text-amber-900" : weekend ? "bg-stone-50 text-stone-600" : "text-stone-600"
                    }`}
                  >
                    <div className="capitalize">{d.weekday}</div>
                    <div className="text-sm font-semibold">{d.day}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {(rooms ?? []).map((room) => {
              const list = byRoom.get(room.id) ?? [];
              const cells: React.ReactNode[] = [];
              for (let i = 0; i < days.length; ) {
                const day = days[i];
                const res = list.find((r) => r.check_in <= day && r.check_out > day);
                if (res) {
                  // Junta os dias seguidos da mesma reserva numa célula só
                  let span = 1;
                  while (i + span < days.length && res.check_out > days[i + span]) span++;
                  cells.push(
                    <td key={day} colSpan={span} className="border-b border-stone-100 p-0.5">
                      <Link
                        href={`/reservas/${res.id}`}
                        title={`${res.guest?.full_name ?? ""} · ${formatDate(res.check_in)} → ${formatDate(res.check_out)}`}
                        className={`block truncate rounded px-2 py-2 font-medium ${CELL[res.status]}`}
                      >
                        {res.guest?.full_name ?? `#${res.id}`}
                      </Link>
                    </td>,
                  );
                  i += span;
                } else {
                  const past = day < today;
                  cells.push(
                    <td key={day} className={`border-b border-stone-100 p-0.5 ${day === today ? "bg-amber-50/50" : ""}`}>
                      {past ? (
                        <span className="block py-2">&nbsp;</span>
                      ) : (
                        <Link
                          href={`/reservas/nova?quarto=${room.id}&entrada=${day}&saida=${addDays(day, 1)}`}
                          aria-label={`Reservar quarto ${room.number} em ${formatDate(day)}`}
                          className="block rounded py-2 text-center text-stone-300 hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          +
                        </Link>
                      )}
                    </td>,
                  );
                  i++;
                }
              }
              return (
                <tr key={room.id}>
                  <th className="sticky left-0 z-10 border-b border-r border-stone-200 bg-white px-3 py-1 text-left">
                    <div className="text-sm font-semibold text-stone-900">{room.number}</div>
                    <div className="font-normal text-stone-500">{room.room_type?.name}</div>
                  </th>
                  {cells}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 flex flex-wrap gap-4 text-xs text-stone-600">
        <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-sky-100" /> Confirmada</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-emerald-200" /> Hospedado</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-stone-200" /> Finalizada</li>
      </ul>
    </div>
  );
}
