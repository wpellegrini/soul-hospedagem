import type { Housekeeping, Reservation, Room } from "@/lib/types";

export type MapReservation = Pick<
  Reservation,
  "id" | "room_id" | "check_in" | "check_out" | "status" | "adults" | "children"
> & { guest: { full_name: string } | null };

export type RoomSituation = "ocupado" | "saida" | "atrasada" | "chegada" | "livre" | "bloqueado";

export type RoomState = {
  room: Room & { room_type: { name: string; capacity: number } | null };
  situation: RoomSituation;
  housekeeping: Housekeeping;
  stay: MapReservation | null;
};

export const SITUATION_LABEL: Record<RoomSituation, string> = {
  ocupado: "Ocupado",
  saida: "Saída hoje",
  atrasada: "Saída atrasada",
  chegada: "Chegada",
  livre: "Livre",
  bloqueado: "Bloqueado",
};

/** Filtro do PostgREST: quem está na casa + quem deveria chegar até hoje. */
export function mapFilter(today: string) {
  return `status.eq.hospedado,and(status.eq.confirmada,check_in.lte.${today},check_out.gt.${today})`;
}

/** Situação de cada quarto hoje, a partir das reservas ativas. */
export function roomStates(
  rooms: RoomState["room"][],
  reservations: MapReservation[],
  today: string,
): RoomState[] {
  return rooms.map((room) => {
    const mine = reservations.filter((r) => r.room_id === room.id);
    const inHouse = mine.find((r) => r.status === "hospedado") ?? null;
    const arriving = mine.find((r) => r.status === "confirmada") ?? null;

    let situation: RoomSituation;
    if (inHouse) {
      situation =
        inHouse.check_out < today ? "atrasada" : inHouse.check_out === today ? "saida" : "ocupado";
    } else if (arriving) {
      situation = "chegada";
    } else if (room.housekeeping === "manutencao") {
      situation = "bloqueado";
    } else {
      situation = "livre";
    }
    return { room, situation, housekeeping: room.housekeeping, stay: inHouse ?? arriving };
  });
}
