import type { Guest } from "@/lib/types";

/** Campos do cadastro de hóspede (usado em "novo" e "editar"). */
export default function GuestFields({ guest }: { guest?: Guest }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="sm:col-span-2">
        <label htmlFor="full_name" className="label">Nome completo</label>
        <input id="full_name" name="full_name" defaultValue={guest?.full_name} className="input" required minLength={3} />
      </div>
      <div>
        <label htmlFor="document" className="label">CPF / documento</label>
        <input id="document" name="document" defaultValue={guest?.document} className="input" />
      </div>
      <div>
        <label htmlFor="phone" className="label">Telefone / WhatsApp</label>
        <input id="phone" name="phone" defaultValue={guest?.phone} className="input" inputMode="tel" />
      </div>
      <div>
        <label htmlFor="email" className="label">E-mail</label>
        <input id="email" name="email" type="email" defaultValue={guest?.email} className="input" />
      </div>
      <div>
        <label htmlFor="city" className="label">Cidade / UF</label>
        <input id="city" name="city" defaultValue={guest?.city} className="input" />
      </div>
      <div>
        <label htmlFor="birth_date" className="label">Nascimento</label>
        <input id="birth_date" name="birth_date" type="date" defaultValue={guest?.birth_date ?? ""} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="notes" className="label">Observações (preferências, alergias...)</label>
        <input id="notes" name="notes" defaultValue={guest?.notes} className="input" />
      </div>
    </div>
  );
}
