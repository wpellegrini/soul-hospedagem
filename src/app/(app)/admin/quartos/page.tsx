import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import type { Room, RoomType } from "@/lib/types";
import ActionForm from "@/components/action-form";
import { createRoom, createRoomType, updateRoom, updateRoomType } from "../actions";

export const metadata: Metadata = { title: "Quartos e tarifas" };

const brl = (n: number) => Number(n).toFixed(2).replace(".", ",");

export default async function AdminRoomsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: types }, { data: rooms }] = await Promise.all([
    supabase.from("room_types").select("*").order("name").returns<RoomType[]>(),
    supabase.from("rooms").select("*").order("number").returns<Room[]>(),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 text-lg font-semibold text-stone-900">Tipos de acomodação</h2>
        <p className="mb-3 text-sm text-stone-500">
          A diária padrão é sugerida em cada nova reserva (pode ser ajustada na hora, ex.: feriados e pacotes).
        </p>
        <div className="card divide-y divide-stone-100">
          {(types ?? []).map((t) => (
            <ActionForm key={t.id} action={updateRoomType} className="grid items-end gap-2 px-4 py-3 sm:grid-cols-[1fr_6rem_8rem_2fr_auto_auto]">
              <input type="hidden" name="id" value={t.id} />
              <Field label="Nome"><input name="name" defaultValue={t.name} className="input" /></Field>
              <Field label="Pessoas"><input name="capacity" type="number" min={1} max={20} defaultValue={t.capacity} className="input" /></Field>
              <Field label="Diária (R$)"><input name="base_rate" inputMode="decimal" defaultValue={brl(t.base_rate)} className="input" /></Field>
              <Field label="Descrição"><input name="description" defaultValue={t.description} className="input" /></Field>
              <label className="flex items-center gap-2 pb-2 text-sm text-stone-600">
                <input type="checkbox" name="active" defaultChecked={t.active} className="h-4 w-4 accent-emerald-700" /> Ativo
              </label>
              <button className="btn-secondary">Salvar</button>
            </ActionForm>
          ))}
          <ActionForm action={createRoomType} className="grid items-end gap-2 bg-stone-50 px-4 py-3 sm:grid-cols-[1fr_6rem_8rem_2fr_auto]">
            <Field label="Novo tipo"><input name="name" placeholder="Ex.: Chalé" className="input" required /></Field>
            <Field label="Pessoas"><input name="capacity" type="number" min={1} max={20} defaultValue={2} className="input" /></Field>
            <Field label="Diária (R$)"><input name="base_rate" inputMode="decimal" placeholder="0,00" className="input" required /></Field>
            <Field label="Descrição"><input name="description" className="input" /></Field>
            <button className="btn-primary">Adicionar</button>
          </ActionForm>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold text-stone-900">Quartos / unidades</h2>
        <p className="mb-3 text-sm text-stone-500">
          Use números (101, 102) ou nomes (Chalé Ipê). Quartos desativados somem do mapa e das novas reservas.
        </p>
        <div className="card divide-y divide-stone-100">
          {(rooms ?? []).map((r) => (
            <ActionForm key={r.id} action={updateRoom} className="grid items-end gap-2 px-4 py-3 sm:grid-cols-[8rem_1fr_1fr_auto_auto]">
              <input type="hidden" name="id" value={r.id} />
              <Field label="Número"><input name="number" defaultValue={r.number} className="input" /></Field>
              <Field label="Tipo">
                <select name="room_type_id" defaultValue={r.room_type_id} className="input">
                  {(types ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="Andar / bloco"><input name="floor" defaultValue={r.floor} className="input" /></Field>
              <label className="flex items-center gap-2 pb-2 text-sm text-stone-600">
                <input type="checkbox" name="active" defaultChecked={r.active} className="h-4 w-4 accent-emerald-700" /> Ativo
              </label>
              <button className="btn-secondary">Salvar</button>
            </ActionForm>
          ))}
          <ActionForm action={createRoom} className="grid items-end gap-2 bg-stone-50 px-4 py-3 sm:grid-cols-[8rem_1fr_1fr_auto]">
            <Field label="Novo quarto"><input name="number" placeholder="Ex.: 104" className="input" required /></Field>
            <Field label="Tipo">
              <select name="room_type_id" className="input" required defaultValue="">
                <option value="" disabled>Escolha...</option>
                {(types ?? []).filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Andar / bloco"><input name="floor" className="input" /></Field>
            <button className="btn-primary">Adicionar</button>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label text-xs">{label}</span>
      {children}
    </label>
  );
}
