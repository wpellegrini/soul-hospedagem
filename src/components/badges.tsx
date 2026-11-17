import { HOUSEKEEPING_LABEL, STATUS_LABEL, type Housekeeping, type ReservationStatus } from "@/lib/types";
import { SITUATION_LABEL, type RoomSituation } from "@/lib/occupancy";

const pill = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap";

const STATUS_STYLE: Record<ReservationStatus, string> = {
  confirmada: "bg-sky-50 text-sky-800 ring-sky-200",
  hospedado: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  finalizada: "bg-stone-100 text-stone-600 ring-stone-200",
  cancelada: "bg-red-50 text-red-700 ring-red-200",
  no_show: "bg-orange-50 text-orange-800 ring-orange-200",
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return <span className={`${pill} ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

const HK_STYLE: Record<Housekeeping, string> = {
  limpo: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  sujo: "bg-amber-50 text-amber-800 ring-amber-200",
  manutencao: "bg-stone-200 text-stone-700 ring-stone-300",
};

export function HousekeepingBadge({ value }: { value: Housekeeping }) {
  return <span className={`${pill} ${HK_STYLE[value]}`}>{HOUSEKEEPING_LABEL[value]}</span>;
}

/** Cores do mapa de quartos (borda/fundo do cartão + selo). */
export const SITUATION_STYLE: Record<RoomSituation, { card: string; badge: string }> = {
  livre: { card: "border-emerald-200 bg-white", badge: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  ocupado: { card: "border-sky-300 bg-sky-50/60", badge: "bg-sky-100 text-sky-900 ring-sky-300" },
  saida: { card: "border-violet-300 bg-violet-50/60", badge: "bg-violet-100 text-violet-900 ring-violet-300" },
  atrasada: { card: "border-red-300 bg-red-50/60", badge: "bg-red-100 text-red-800 ring-red-300" },
  chegada: { card: "border-amber-300 bg-amber-50/60", badge: "bg-amber-100 text-amber-900 ring-amber-300" },
  bloqueado: { card: "border-stone-300 bg-stone-100", badge: "bg-stone-200 text-stone-700 ring-stone-300" },
};

export function SituationBadge({ value }: { value: RoomSituation }) {
  return <span className={`${pill} ${SITUATION_STYLE[value].badge}`}>{SITUATION_LABEL[value]}</span>;
}
