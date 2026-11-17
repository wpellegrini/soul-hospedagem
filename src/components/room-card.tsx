import Link from "next/link";
import { formatDate } from "@/lib/types";
import type { RoomState } from "@/lib/occupancy";
import { HousekeepingBadge, SituationBadge, SITUATION_STYLE } from "@/components/badges";

/** Cartão de um quarto no mapa: situação, hóspede e limpeza. */
export default function RoomCard({
  state,
  linkToStay,
  children,
}: {
  state: RoomState;
  linkToStay: boolean;
  children?: React.ReactNode;
}) {
  const { room, situation, housekeeping, stay } = state;
  const guestName = stay?.guest?.full_name;

  return (
    <div className={`flex flex-col rounded-lg border-2 p-3 ${SITUATION_STYLE[situation].card}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xl font-semibold leading-none text-stone-900">{room.number}</div>
          <div className="mt-1 text-xs text-stone-500">{room.room_type?.name}</div>
        </div>
        <SituationBadge value={situation} />
      </div>

      <div className="mt-3 min-h-10 text-sm">
        {stay ? (
          linkToStay ? (
            <Link href={`/reservas/${stay.id}`} className="block hover:underline">
              <span className="block truncate font-medium text-stone-800">{guestName ?? `Reserva #${stay.id}`}</span>
              <span className="text-xs text-stone-500">
                {formatDate(stay.check_in)} → {formatDate(stay.check_out)}
              </span>
            </Link>
          ) : (
            <span className="text-xs text-stone-500">
              {stay.adults + stay.children} pessoa(s) · saída {formatDate(stay.check_out)}
            </span>
          )
        ) : (
          <span className="text-xs text-stone-400">Sem hóspede</span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <HousekeepingBadge value={housekeeping} />
        {room.notes && (
          <span className="truncate text-xs text-stone-500" title={room.notes}>
            {room.notes}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
