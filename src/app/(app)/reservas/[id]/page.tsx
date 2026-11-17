import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFront } from "@/lib/auth";
import { loadTotals } from "@/lib/queries";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  formatDate,
  formatDateTime,
  formatMoney,
  nights,
  PAYMENT_LABEL,
  PAYMENT_METHODS,
  SOURCE_LABEL,
  todayISO,
  whatsappLink,
  type Charge,
  type Guest,
  type Payment,
  type Product,
  type Reservation,
  type Room,
  type RoomType,
} from "@/lib/types";
import { HousekeepingBadge, StatusBadge } from "@/components/badges";
import ActionForm from "@/components/action-form";
import {
  addCharge,
  addPayment,
  changeStatus,
  removeCharge,
  removePayment,
  updateReservation,
} from "../actions";

type Row = Reservation & {
  guest: Guest;
  room: Room & { room_type: RoomType };
  creator: { full_name: string } | null;
};

export async function generateMetadata({ params }: PageProps<"/reservas/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Reserva #${id}` };
}

export default async function ReservationPage({ params, searchParams }: PageProps<"/reservas/[id]">) {
  const { supabase, profile } = await requireFront();
  const { id } = await params;
  const sp = await searchParams;
  const aviso = typeof sp.aviso === "string" ? sp.aviso : "";
  const resId = Number(id);
  if (!Number.isInteger(resId)) notFound();

  const { data: r } = await supabase
    .from("reservations")
    .select("*, guest:guests(*), room:rooms(*, room_type:room_types(*)), creator:profiles!reservations_created_by_fkey(full_name)")
    .eq("id", resId)
    .maybeSingle<Row>();
  if (!r) notFound();

  const [{ data: charges }, { data: payments }, { data: products }, { data: rooms }, totalsMap] = await Promise.all([
    supabase.from("charges").select("*").eq("reservation_id", r.id).order("created_at").returns<Charge[]>(),
    supabase.from("payments").select("*").eq("reservation_id", r.id).order("created_at").returns<Payment[]>(),
    supabase.from("products").select("*").eq("active", true).order("name").returns<Product[]>(),
    supabase
      .from("rooms")
      .select("id, number, room_type:room_types(name, capacity)")
      .eq("active", true)
      .order("number")
      .returns<{ id: number; number: string; room_type: { name: string; capacity: number } | null }[]>(),
    loadTotals(supabase, [resId]),
  ]);
  const t = totalsMap.get(resId);
  const balance = Number(t?.balance ?? 0);
  const today = todayISO();

  const active = r.status === "confirmada" || r.status === "hospedado";
  const inHouse = r.status === "hospedado";
  const wa = whatsappLink(r.guest.phone);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reservas" className="text-sm text-stone-500 hover:text-stone-800">
          ← Reservas
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-stone-900">Reserva #{r.id}</h1>
          <StatusBadge status={r.status} />
        </div>
        <p className="text-sm text-stone-500">
          <Link href={`/hospedes/${r.guest.id}`} className="font-medium text-stone-800 hover:underline">
            {r.guest.full_name}
          </Link>{" "}
          · Quarto {r.room.number} ({r.room.room_type.name}) · {formatDate(r.check_in)} → {formatDate(r.check_out)}
        </p>
      </div>

      {aviso && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{aviso}</p>}

      {/* Ações principais */}
      {active && (
        <section className="card flex flex-wrap items-center gap-3 p-4">
          {r.status === "confirmada" && (
            <>
              <StatusButton id={r.id} status="hospedado" label="Fazer check-in" primary disabled={today < r.check_in} />
              {today < r.check_in && (
                <span className="text-xs text-stone-500">Check-in liberado a partir de {formatDate(r.check_in)}.</span>
              )}
              {r.room.housekeeping !== "limpo" && (
                <span className="flex items-center gap-1 text-xs text-stone-500">
                  Quarto: <HousekeepingBadge value={r.room.housekeeping} />
                </span>
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                {today >= r.check_in && <StatusButton id={r.id} status="no_show" label="Não compareceu" />}
                <StatusButton id={r.id} status="cancelada" label="Cancelar reserva" danger />
              </div>
            </>
          )}
          {inHouse && (
            <>
              {/* key: saldo mudou → descarta a mensagem de erro antiga */}
              <StatusButton key={`co-${balance}`} id={r.id} status="finalizada" label="Fazer check-out" primary />
              <span className={`text-sm ${balance > 0 ? "text-red-700" : "text-emerald-700"}`}>
                {balance > 0
                  ? `Saldo a pagar: ${formatMoney(balance)}. Registre o pagamento antes do check-out.`
                  : balance < 0
                    ? `Crédito do hóspede: ${formatMoney(-balance)} (devolver troco).`
                    : "Conta quitada."}
              </span>
              {today < r.check_out && (
                <span className="text-xs text-stone-500">
                  Saída antecipada: as diárias serão cobradas até hoje.
                </span>
              )}
            </>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {/* Consumo */}
          <section className="card">
            <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold text-stone-900">
              Consumo e serviços
            </h2>
            <Lines
              empty="Nenhum consumo lançado."
              rows={(charges ?? []).map((c) => ({
                id: c.id,
                when: formatDateTime(c.created_at),
                text: `${c.quantity} × ${c.description}`,
                sub: formatMoney(c.unit_price),
                value: formatMoney(c.total),
              }))}
              remove={inHouse ? removeCharge : undefined}
              removeLabel="Estornar"
            />
            {inHouse && (
              <div className="grid gap-4 border-t border-stone-100 p-4 md:grid-cols-2">
                <ActionForm action={addCharge} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="reservation_id" value={r.id} />
                  <div className="min-w-0 flex-1">
                    <label htmlFor="product_id" className="label">Produto</label>
                    <select id="product_id" name="product_id" className="input" required defaultValue="">
                      <option value="" disabled>Escolha...</option>
                      {CATEGORIES.map((cat) => (
                        <optgroup key={cat} label={CATEGORY_LABEL[cat]}>
                          {(products ?? [])
                            .filter((p) => p.category === cat)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {formatMoney(p.price)}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="w-20">
                    <label htmlFor="quantity" className="label">Qtd.</label>
                    <input id="quantity" name="quantity" type="number" min={1} defaultValue={1} className="input" />
                  </div>
                  <button className="btn-secondary">Lançar</button>
                </ActionForm>
                <ActionForm action={addCharge} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="reservation_id" value={r.id} />
                  <div className="min-w-0 flex-1">
                    <label htmlFor="description" className="label">Lançamento avulso</label>
                    <input id="description" name="description" placeholder="Ex.: taxa de pet" className="input" required />
                  </div>
                  <div className="w-24">
                    <label htmlFor="unit_price" className="label">Valor</label>
                    <input id="unit_price" name="unit_price" inputMode="decimal" className="input" required />
                  </div>
                  <button className="btn-secondary">Lançar</button>
                </ActionForm>
              </div>
            )}
          </section>

          {/* Pagamentos */}
          <section className="card">
            <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold text-stone-900">Pagamentos</h2>
            <Lines
              empty="Nenhum pagamento registrado."
              rows={(payments ?? []).map((p) => ({
                id: p.id,
                when: formatDateTime(p.created_at),
                text: PAYMENT_LABEL[p.method],
                sub: p.notes,
                value: formatMoney(p.amount),
              }))}
              remove={profile.role === "admin" ? removePayment : undefined}
              removeLabel="Excluir"
            />
            {active && (
              <ActionForm action={addPayment} className="flex flex-wrap items-end gap-2 border-t border-stone-100 p-4">
                <input type="hidden" name="reservation_id" value={r.id} />
                <div className="w-32">
                  <label htmlFor="amount" className="label">Valor (R$)</label>
                  <input
                    key={`amount-${balance}`} // atualiza o valor sugerido quando o saldo muda
                    id="amount"
                    name="amount"
                    inputMode="decimal"
                    defaultValue={balance > 0 ? balance.toFixed(2).replace(".", ",") : ""}
                    className="input"
                    required
                  />
                </div>
                <div className="w-44">
                  <label htmlFor="method" className="label">Forma</label>
                  <select id="method" name="method" className="input" defaultValue="pix">
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{PAYMENT_LABEL[m]}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-40 flex-1">
                  <label htmlFor="pay_notes" className="label">Observação</label>
                  <input id="pay_notes" name="notes" placeholder={r.status === "confirmada" ? "Ex.: sinal de 50%" : ""} className="input" />
                </div>
                <button className="btn-primary">Registrar</button>
              </ActionForm>
            )}
          </section>

          {/* Edição */}
          {active && (
            <section className="card p-4">
              <h2 className="mb-3 text-sm font-semibold text-stone-900">
                {inHouse ? "Alterar estadia (troca de quarto, prorrogação)" : "Alterar reserva"}
              </h2>
              <ActionForm action={updateReservation} className="grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="id" value={r.id} />
                {inHouse && <input type="hidden" name="check_in" value={r.check_in} />}
                <div>
                  <label htmlFor="room_id" className="label">Quarto</label>
                  <select id="room_id" name="room_id" defaultValue={r.room_id} className="input">
                    {(rooms ?? []).map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.number} · {room.room_type?.name} (até {room.room_type?.capacity})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="check_in" className="label">Entrada</label>
                  <input id="check_in" name={inHouse ? undefined : "check_in"} type="date" defaultValue={r.check_in} disabled={inHouse} className="input" />
                </div>
                <div>
                  <label htmlFor="check_out" className="label">Saída</label>
                  <input id="check_out" name="check_out" type="date" defaultValue={r.check_out} className="input" />
                </div>
                <div>
                  <label htmlFor="adults_e" className="label">Adultos</label>
                  <input id="adults_e" name="adults" type="number" min={1} defaultValue={r.adults} className="input" />
                </div>
                <div>
                  <label htmlFor="children_e" className="label">Crianças</label>
                  <input id="children_e" name="children" type="number" min={0} defaultValue={r.children} className="input" />
                </div>
                <div>
                  <label htmlFor="rate_e" className="label">Diária (R$)</label>
                  <input id="rate_e" name="daily_rate" inputMode="decimal" defaultValue={Number(r.daily_rate).toFixed(2).replace(".", ",")} className="input" />
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor="notes_e" className="label">Observações</label>
                  <textarea id="notes_e" name="notes" rows={2} defaultValue={r.notes} className="input" />
                </div>
                <div className="sm:col-span-3">
                  <button className="btn-secondary">Salvar alterações</button>
                </div>
              </ActionForm>
            </section>
          )}
        </div>

        {/* Lateral: conta e dados */}
        <aside className="space-y-6">
          <section className="card p-4 text-sm">
            <h2 className="mb-3 font-semibold text-stone-900">Conta</h2>
            <dl className="space-y-2">
              <Item label={`Hospedagem (${nights(Number(t?.nights ?? 0))} × ${formatMoney(r.daily_rate)})`} value={formatMoney(t?.lodging_total)} />
              <Item label="Consumo e serviços" value={formatMoney(t?.charges_total)} />
              <Item label="Total" value={formatMoney(Number(t?.lodging_total ?? 0) + Number(t?.charges_total ?? 0))} strong />
              <Item label="Pago" value={`− ${formatMoney(t?.payments_total)}`} />
            </dl>
            <div className={`mt-3 flex justify-between border-t border-stone-200 pt-3 text-base font-semibold ${balance > 0 ? "text-red-700" : "text-emerald-700"}`}>
              <span>{balance >= 0 ? "Saldo" : "Crédito"}</span>
              <span>{formatMoney(Math.abs(balance))}</span>
            </div>
            <Link href={`/reservas/${r.id}/extrato`} className="btn-secondary mt-4 w-full">
              Extrato para impressão
            </Link>
          </section>

          <section className="card p-4 text-sm">
            <h2 className="mb-3 font-semibold text-stone-900">Hóspede</h2>
            <div className="font-medium text-stone-900">{r.guest.full_name}</div>
            <div className="mt-1 space-y-0.5 text-stone-600">
              {r.guest.document && <div>Doc.: {r.guest.document}</div>}
              {r.guest.phone && <div>Tel.: {r.guest.phone}</div>}
              {r.guest.email && <div>{r.guest.email}</div>}
            </div>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-3 w-full">
                Conversar no WhatsApp
              </a>
            )}
          </section>

          <section className="card p-4 text-sm">
            <h2 className="mb-3 font-semibold text-stone-900">Detalhes</h2>
            <dl className="space-y-2">
              <Item label="Pessoas" value={`${r.adults} adulto(s)${r.children ? `, ${r.children} criança(s)` : ""}`} />
              <Item label="Origem" value={SOURCE_LABEL[r.source] ?? r.source} />
              <Item label="Criada em" value={formatDateTime(r.created_at)} />
              <Item label="Criada por" value={r.creator?.full_name || "—"} />
              <Item label="Check-in" value={formatDateTime(r.checked_in_at)} />
              <Item label="Check-out" value={formatDateTime(r.checked_out_at)} />
              {r.cancelled_at && <Item label="Cancelada em" value={formatDateTime(r.cancelled_at)} />}
            </dl>
            {r.notes && <p className="mt-3 rounded bg-stone-50 p-2 text-stone-700 whitespace-pre-wrap">{r.notes}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatusButton({
  id,
  status,
  label,
  primary,
  danger,
  disabled,
}: {
  id: number;
  status: string;
  label: string;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <ActionForm action={changeStatus} className="flex flex-col">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={primary ? "btn-primary" : danger ? "btn-danger" : "btn-secondary"} disabled={disabled}>
        {label}
      </button>
    </ActionForm>
  );
}

function Lines({
  rows,
  empty,
  remove,
  removeLabel,
}: {
  rows: { id: number; when: string; text: string; sub: string; value: string }[];
  empty: string;
  remove?: (formData: FormData) => Promise<void>;
  removeLabel: string;
}) {
  if (!rows.length) return <p className="px-4 py-5 text-sm text-stone-500">{empty}</p>;
  return (
    <ul className="divide-y divide-stone-100 text-sm">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-stone-800">{row.text}</div>
            <div className="text-xs text-stone-500">
              {row.when}
              {row.sub && ` · ${row.sub}`}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium whitespace-nowrap">{row.value}</span>
            {remove && (
              <form action={remove}>
                <input type="hidden" name="id" value={row.id} />
                <button className="text-xs text-red-700 hover:underline">{removeLabel}</button>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Item({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold text-stone-900" : ""}`}>
      <dt className={strong ? "" : "text-stone-500"}>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
