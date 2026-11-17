import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  formatDateTime,
  formatMoney,
  type Charge,
  type Product,
  type Reservation,
} from "@/lib/types";
import ActionForm from "@/components/action-form";
import { addChargesBatch } from "../reservas/actions";

export const metadata: Metadata = { title: "Consumo" };

type InHouse = Pick<Reservation, "id" | "check_out"> & { room: { number: string } | null };
type Recent = Charge & { reservation: { room: { number: string } | null } | null };

function param(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : (v ?? "");
}

export default async function ConsumptionPage({ searchParams }: PageProps<"/consumo">) {
  const { supabase } = await requireUser();
  const sp = await searchParams;
  const category = (CATEGORIES as string[]).includes(param(sp.categoria)) ? param(sp.categoria) : "frigobar";

  const [{ data: stays }, { data: products }, { data: recent }] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, check_out, room:rooms(number)")
      .eq("status", "hospedado")
      .returns<InHouse[]>(),
    supabase.from("products").select("*").eq("active", true).eq("category", category).order("name").returns<Product[]>(),
    supabase
      .from("charges")
      .select("*, reservation:reservations(room:rooms(number))")
      .order("created_at", { ascending: false })
      .limit(15)
      .returns<Recent[]>(),
  ]);

  const rooms = (stays ?? []).sort((a, b) => (a.room?.number ?? "").localeCompare(b.room?.number ?? "", "pt-BR", { numeric: true }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Lançar consumo</h1>
        <p className="mb-4 text-sm text-stone-500">
          Conferência do frigobar e pedidos: o valor entra direto na conta do hóspede.
        </p>

        <nav className="mb-4 flex gap-2 text-sm">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`/consumo?categoria=${c}`}
              className={`rounded-full px-3 py-1 font-medium ring-1 ring-inset ${
                category === c ? "bg-brand text-white ring-brand" : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-50"
              }`}
            >
              {CATEGORY_LABEL[c]}
            </Link>
          ))}
        </nav>

        {rooms.length === 0 ? (
          <p className="card p-6 text-sm text-stone-500">Nenhum hóspede na casa no momento.</p>
        ) : (
          <ActionForm action={addChargesBatch} className="card space-y-4 p-4">
            <div>
              <label htmlFor="reservation_id" className="label">Quarto</label>
              <select id="reservation_id" name="reservation_id" className="input max-w-xs" required defaultValue="">
                <option value="" disabled>Escolha o quarto...</option>
                {rooms.map((s) => (
                  <option key={s.id} value={s.id}>
                    Quarto {s.room?.number}
                  </option>
                ))}
              </select>
            </div>
            {(products ?? []).length === 0 ? (
              <p className="text-sm text-stone-500">Nenhum produto ativo nesta categoria.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {(products ?? []).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2">
                    <label htmlFor={`qty_${p.id}`} className="min-w-0 text-sm">
                      <span className="block truncate font-medium text-stone-800">{p.name}</span>
                      <span className="text-xs text-stone-500">{formatMoney(p.price)}</span>
                    </label>
                    <input
                      id={`qty_${p.id}`}
                      name={`qty_${p.id}`}
                      type="number"
                      min={0}
                      max={99}
                      defaultValue={0}
                      className="input w-20 text-center"
                    />
                  </li>
                ))}
              </ul>
            )}
            <button className="btn-primary">Lançar na conta</button>
          </ActionForm>
        )}
      </div>

      <aside className="card h-fit">
        <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold text-stone-900">Últimos lançamentos</h2>
        {(recent ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500">Nada lançado ainda.</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {(recent ?? []).map((c) => (
              <li key={c.id} className="flex justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-stone-800">
                    {c.quantity} × {c.description}
                  </div>
                  <div className="text-xs text-stone-500">
                    Quarto {c.reservation?.room?.number} · {formatDateTime(c.created_at)}
                  </div>
                </div>
                <span className="font-medium whitespace-nowrap">{formatMoney(c.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
