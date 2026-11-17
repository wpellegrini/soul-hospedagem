import type { Metadata } from "next";
import { getSettings, requireAdmin } from "@/lib/auth";
import { formatTime, KIND_LABEL } from "@/lib/types";
import ActionForm from "@/components/action-form";
import { updateSettings } from "../actions";

export const metadata: Metadata = { title: "Estabelecimento" };

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();

  return (
    <ActionForm action={updateSettings} className="card grid max-w-2xl gap-4 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="property_name" className="label">Nome do estabelecimento</label>
        <input id="property_name" name="property_name" defaultValue={s.property_name} className="input" required />
      </div>
      <div>
        <label htmlFor="property_kind" className="label">Tipo</label>
        <select id="property_kind" name="property_kind" defaultValue={s.property_kind} className="input">
          {(["pousada", "hotel"] as const).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="phone" className="label">Telefone</label>
        <input id="phone" name="phone" defaultValue={s.phone} className="input" />
      </div>
      <div>
        <label htmlFor="checkin_time" className="label">Check-in a partir de</label>
        <input id="checkin_time" name="checkin_time" type="time" defaultValue={formatTime(s.checkin_time)} className="input" />
      </div>
      <div>
        <label htmlFor="checkout_time" className="label">Check-out até</label>
        <input id="checkout_time" name="checkout_time" type="time" defaultValue={formatTime(s.checkout_time)} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="address" className="label">Endereço (aparece no extrato)</label>
        <input id="address" name="address" defaultValue={s.address} className="input" />
      </div>
      <div className="sm:col-span-2">
        <button className="btn-primary">Salvar</button>
      </div>
    </ActionForm>
  );
}
