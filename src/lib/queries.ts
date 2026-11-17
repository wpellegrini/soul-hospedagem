import type { SupabaseClient } from "@supabase/supabase-js";
import { mapFilter, roomStates, type MapReservation, type RoomState } from "@/lib/occupancy";
import type { ReservationTotals } from "@/lib/types";

/** Quartos ativos com a situação de hoje. */
export async function loadRoomMap(supabase: SupabaseClient, today: string) {
  const [{ data: rooms }, { data: stays }] = await Promise.all([
    supabase
      .from("rooms")
      .select("*, room_type:room_types(name, capacity)")
      .eq("active", true)
      .order("number")
      .returns<RoomState["room"][]>(),
    supabase
      .from("reservations")
      .select("id, room_id, check_in, check_out, status, adults, children, guest:guests(full_name)")
      .or(mapFilter(today))
      .returns<MapReservation[]>(),
  ]);
  return roomStates(rooms ?? [], stays ?? [], today);
}

/** Totais financeiros (diárias, consumo, pagos, saldo) das reservas informadas. */
export async function loadTotals(supabase: SupabaseClient, ids: number[]) {
  const map = new Map<number, ReservationTotals>();
  if (!ids.length) return map;
  const { data } = await supabase
    .from("reservation_totals")
    .select("*")
    .in("reservation_id", ids)
    .returns<ReservationTotals[]>();
  for (const t of data ?? []) map.set(t.reservation_id, t);
  return map;
}
