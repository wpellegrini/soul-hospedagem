import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings, requireFront } from "@/lib/auth";
import { loadTotals } from "@/lib/queries";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  KIND_LABEL,
  PAYMENT_LABEL,
  STATUS_LABEL,
  type Charge,
  type Payment,
  type Reservation,
} from "@/lib/types";
import PrintButton from "./print-button";

export const metadata: Metadata = { title: "Extrato" };

type Row = Reservation & {
  guest: { full_name: string; document: string };
  room: { number: string; room_type: { name: string } | null };
};

export default async function StatementPage({ params }: PageProps<"/reservas/[id]/extrato">) {
  const { supabase } = await requireFront();
  const settings = await getSettings();
  const { id } = await params;
  const resId = Number(id);

  const { data: r } = await supabase
    .from("reservations")
    .select("*, guest:guests(full_name, document), room:rooms(number, room_type:room_types(name))")
    .eq("id", resId)
    .maybeSingle<Row>();
  if (!r) notFound();

  const [{ data: charges }, { data: payments }, totals] = await Promise.all([
    supabase.from("charges").select("*").eq("reservation_id", resId).order("created_at").returns<Charge[]>(),
    supabase.from("payments").select("*").eq("reservation_id", resId).order("created_at").returns<Payment[]>(),
    loadTotals(supabase, [resId]),
  ]);
  const t = totals.get(resId);
  const balance = Number(t?.balance ?? 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/reservas/${r.id}`} className="text-sm text-stone-500 hover:text-stone-800">
          ← Voltar para a reserva
        </Link>
        <PrintButton />
      </div>

      <article className="card p-8 text-sm print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">{settings.property_name}</h1>
            <p className="text-stone-500">
              {KIND_LABEL[settings.property_kind]}
              {settings.address && ` · ${settings.address}`}
              {settings.phone && ` · ${settings.phone}`}
            </p>
          </div>
          <div className="text-right">
            <div className="font-semibold text-stone-900">Extrato da reserva #{r.id}</div>
            <div className="text-stone-500">Emitido em {formatDateTime(new Date().toISOString())}</div>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-stone-200 py-4 sm:grid-cols-4">
          <Field label="Hóspede" value={r.guest.full_name} />
          <Field label="Documento" value={r.guest.document || "—"} />
          <Field label="Quarto" value={`${r.room.number} · ${r.room.room_type?.name ?? ""}`} />
          <Field label="Situação" value={STATUS_LABEL[r.status]} />
          <Field label="Entrada" value={formatDate(r.check_in)} />
          <Field label="Saída" value={formatDate(r.check_out)} />
          <Field label="Pessoas" value={String(r.adults + r.children)} />
          <Field label="Diárias" value={String(t?.nights ?? 0)} />
        </dl>

        <table className="mt-4 w-full">
          <thead className="border-b border-stone-200 text-left text-xs text-stone-500">
            <tr>
              <th className="py-2 font-medium">Descrição</th>
              <th className="py-2 text-right font-medium">Qtd.</th>
              <th className="py-2 text-right font-medium">Unitário</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            <tr>
              <td className="py-2">Hospedagem ({formatDate(r.check_in)} a {formatDate(r.check_out)})</td>
              <td className="py-2 text-right">{t?.nights ?? 0}</td>
              <td className="py-2 text-right">{formatMoney(r.daily_rate)}</td>
              <td className="py-2 text-right">{formatMoney(t?.lodging_total)}</td>
            </tr>
            {(charges ?? []).map((c) => (
              <tr key={c.id}>
                <td className="py-2">
                  {c.description} <span className="text-xs text-stone-400">({formatDateTime(c.created_at)})</span>
                </td>
                <td className="py-2 text-right">{c.quantity}</td>
                <td className="py-2 text-right">{formatMoney(c.unit_price)}</td>
                <td className="py-2 text-right">{formatMoney(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 border-t border-stone-200 pt-3">
          <Total label="Total" value={formatMoney(Number(t?.lodging_total ?? 0) + Number(t?.charges_total ?? 0))} />
          {(payments ?? []).map((p) => (
            <Total key={p.id} label={`Pago · ${PAYMENT_LABEL[p.method]} (${formatDateTime(p.created_at)})`} value={`− ${formatMoney(p.amount)}`} muted />
          ))}
          <Total label={balance >= 0 ? "Saldo a pagar" : "Crédito do hóspede"} value={formatMoney(Math.abs(balance))} strong />
        </div>

        <p className="mt-10 text-center text-xs text-stone-400">
          Documento sem valor fiscal · Obrigado pela preferência!
        </p>
      </article>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="font-medium text-stone-900">{value}</dd>
    </div>
  );
}

function Total({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "pt-1 text-base font-semibold" : ""} ${muted ? "text-stone-500" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
