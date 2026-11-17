import type { Metadata } from "next";
import Link from "next/link";
import { requireFront } from "@/lib/auth";
import { formatDate, type Guest } from "@/lib/types";
import ActionForm from "@/components/action-form";
import GuestFields from "@/components/guest-fields";
import { createGuest } from "./actions";

export const metadata: Metadata = { title: "Hóspedes" };

type Row = Guest & { reservations: { check_in: string; status: string }[] };

function param(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : (v ?? "");
}

export default async function GuestsPage({ searchParams }: PageProps<"/hospedes">) {
  const { supabase } = await requireFront();
  const sp = await searchParams;
  const q = param(sp.q).trim().replace(/[,()]/g, " ");

  let query = supabase
    .from("guests")
    .select("*, reservations(check_in, status)")
    .order("full_name")
    .limit(200);
  if (q) query = query.or(`full_name.ilike.%${q}%,document.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);

  const { data } = await query.returns<Row[]>();
  const guests = data ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Hóspedes</h1>
          <p className="text-sm text-stone-500">{guests.length} encontrados</p>
        </div>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Nome, documento, telefone ou e-mail" className="input w-72" aria-label="Buscar hóspede" />
          <button className="btn-secondary">Buscar</button>
        </form>
      </div>

      <details className="card mb-6 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-stone-900">+ Cadastrar hóspede</summary>
        <ActionForm action={createGuest} className="mt-4 space-y-3">
          <GuestFields />
          <button className="btn-primary">Cadastrar</button>
        </ActionForm>
      </details>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-stone-200 text-left text-xs text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Documento</th>
              <th className="px-4 py-2 font-medium">Contato</th>
              <th className="px-4 py-2 font-medium">Cidade</th>
              <th className="px-4 py-2 text-right font-medium">Estadias</th>
              <th className="px-4 py-2 font-medium">Última entrada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {guests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-500">Nenhum hóspede encontrado.</td>
              </tr>
            )}
            {guests.map((g) => {
              const stays = g.reservations.filter((r) => r.status === "finalizada" || r.status === "hospedado");
              const last = g.reservations.map((r) => r.check_in).sort().at(-1) ?? null;
              return (
                <tr key={g.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <Link href={`/hospedes/${g.id}`} className="font-medium text-stone-900 hover:underline">
                      {g.full_name}
                    </Link>
                    {stays.length >= 2 && (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                        Recorrente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{g.document || "—"}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {g.phone || "—"}
                    {g.email && <div className="text-xs text-stone-400">{g.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{g.city || "—"}</td>
                  <td className="px-4 py-3 text-right">{stays.length}</td>
                  <td className="px-4 py-3 text-stone-600">{formatDate(last)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
