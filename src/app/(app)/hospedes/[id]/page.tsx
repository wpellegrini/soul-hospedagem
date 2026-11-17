import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFront } from "@/lib/auth";
import { loadTotals } from "@/lib/queries";
import { formatDate, formatMoney, whatsappLink, type Guest, type Reservation } from "@/lib/types";
import ActionForm from "@/components/action-form";
import GuestFields from "@/components/guest-fields";
import { StatusBadge } from "@/components/badges";
import { updateGuest } from "../actions";

export const metadata: Metadata = { title: "Hóspede" };

type Stay = Reservation & { room: { number: string } | null };

export default async function GuestPage({ params }: PageProps<"/hospedes/[id]">) {
  const { supabase } = await requireFront();
  const { id } = await params;

  const { data: guest } = await supabase.from("guests").select("*").eq("id", Number(id)).maybeSingle<Guest>();
  if (!guest) notFound();

  const { data } = await supabase
    .from("reservations")
    .select("*, room:rooms(number)")
    .eq("guest_id", guest.id)
    .order("check_in", { ascending: false })
    .returns<Stay[]>();
  const stays = data ?? [];
  const totals = await loadTotals(supabase, stays.map((s) => s.id));

  const spent = stays
    .filter((s) => s.status === "finalizada" || s.status === "hospedado")
    .reduce((sum, s) => sum + Number(totals.get(s.id)?.lodging_total ?? 0) + Number(totals.get(s.id)?.charges_total ?? 0), 0);
  const nightsTotal = stays
    .filter((s) => s.status === "finalizada" || s.status === "hospedado")
    .reduce((n, s) => n + Number(totals.get(s.id)?.nights ?? 0), 0);
  const wa = whatsappLink(guest.phone);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/hospedes" className="text-sm text-stone-500 hover:text-stone-800">
            ← Hóspedes
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-stone-900">{guest.full_name}</h1>
          <p className="text-sm text-stone-500">
            {stays.length} reserva(s) · {nightsTotal} diária(s) · {formatMoney(spent)} em hospedagem e consumo
          </p>
        </div>
        <div className="flex gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              WhatsApp
            </a>
          )}
          <Link href="/reservas/nova" className="btn-primary">
            + Nova reserva
          </Link>
        </div>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-stone-900">Cadastro</h2>
        <ActionForm action={updateGuest} className="space-y-3">
          <input type="hidden" name="id" value={guest.id} />
          <GuestFields guest={guest} />
          <button className="btn-secondary">Salvar</button>
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold text-stone-900">Histórico de estadias</h2>
        {stays.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500">Nenhuma reserva ainda.</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {stays.map((s) => {
              const t = totals.get(s.id);
              return (
                <li key={s.id}>
                  <Link href={`/reservas/${s.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
                    <span>
                      <span className="font-medium text-stone-900">#{s.id}</span> · Quarto {s.room?.number} ·{" "}
                      {formatDate(s.check_in)} → {formatDate(s.check_out)}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-stone-600">
                        {formatMoney(Number(t?.lodging_total ?? 0) + Number(t?.charges_total ?? 0))}
                      </span>
                      <StatusBadge status={s.status} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
