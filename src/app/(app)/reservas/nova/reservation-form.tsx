"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/form";
import { SOURCE_LABEL, SOURCES, type Guest } from "@/lib/types";
import { createReservation } from "../actions";

export default function ReservationForm({
  roomId,
  checkIn,
  checkOut,
  people,
  baseRate,
  capacity,
  canCheckInNow,
  guests,
}: {
  roomId: number;
  checkIn: string;
  checkOut: string;
  people: number;
  baseRate: number;
  capacity: number;
  canCheckInNow: boolean;
  guests: Pick<Guest, "id" | "full_name" | "document" | "phone">[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createReservation, {});
  const [mode, setMode] = useState<"existente" | "novo">(guests.length ? "existente" : "novo");

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="room_id" value={roomId} />
      <input type="hidden" name="check_in" value={checkIn} />
      <input type="hidden" name="check_out" value={checkOut} />
      <input type="hidden" name="guest_mode" value={mode} />

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-stone-900">Hóspede responsável</legend>
        <div className="mb-3 inline-grid grid-cols-2 rounded-md bg-stone-100 p-1 text-sm">
          {(["existente", "novo"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              disabled={m === "existente" && !guests.length}
              className={`rounded px-3 py-1.5 font-medium transition disabled:opacity-40 ${
                mode === m ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
              }`}
            >
              {m === "existente" ? "Já cadastrado" : "Novo hóspede"}
            </button>
          ))}
        </div>

        {mode === "existente" ? (
          <select name="guest_id" className="input" required aria-label="Hóspede" defaultValue="">
            <option value="" disabled>
              Escolha o hóspede...
            </option>
            {guests.map((g) => (
              <option key={g.id} value={g.id}>
                {g.full_name}
                {g.document ? ` · ${g.document}` : ""}
                {g.phone ? ` · ${g.phone}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="guest_name" className="label">Nome completo</label>
              <input id="guest_name" name="guest_name" className="input" required minLength={3} />
            </div>
            <div>
              <label htmlFor="guest_document" className="label">CPF / documento</label>
              <input id="guest_document" name="guest_document" className="input" />
            </div>
            <div>
              <label htmlFor="guest_phone" className="label">Telefone / WhatsApp</label>
              <input id="guest_phone" name="guest_phone" className="input" inputMode="tel" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="guest_email" className="label">E-mail</label>
              <input id="guest_email" name="guest_email" type="email" className="input" />
            </div>
          </div>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="adults" className="label">Adultos</label>
          <input id="adults" name="adults" type="number" min={1} max={capacity} defaultValue={Math.min(people, capacity)} className="input" />
        </div>
        <div>
          <label htmlFor="children" className="label">Crianças</label>
          <input id="children" name="children" type="number" min={0} max={capacity} defaultValue={0} className="input" />
        </div>
        <div>
          <label htmlFor="daily_rate" className="label">Diária (R$)</label>
          <input id="daily_rate" name="daily_rate" inputMode="decimal" defaultValue={baseRate.toFixed(2).replace(".", ",")} className="input" />
        </div>
        <div>
          <label htmlFor="source" className="label">Origem</label>
          <select id="source" name="source" className="input" defaultValue="balcao">
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="label">Observações</label>
        <textarea id="notes" name="notes" rows={2} className="input" placeholder="Horário de chegada, pedidos especiais, alergias..." />
      </div>

      {canCheckInNow && (
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="checkin_now" className="h-4 w-4 accent-emerald-700" />
          Hóspede já está aqui: fazer o check-in agora
        </label>
      )}

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button className="btn-primary w-full sm:w-auto" disabled={pending}>
        {pending ? "Salvando..." : "Confirmar reserva"}
      </button>
    </form>
  );
}
