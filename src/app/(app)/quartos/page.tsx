import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadRoomMap } from "@/lib/queries";
import { formatDate, HOUSEKEEPING, HOUSEKEEPING_LABEL, isFront, todayISO, type Housekeeping } from "@/lib/types";
import RoomCard from "@/components/room-card";
import ActionForm from "@/components/action-form";
import { setHousekeeping } from "./actions";

export const metadata: Metadata = { title: "Quartos" };

const FILTERS = [
  { value: "", label: "Todos" },
  { value: "sujo", label: "Para limpar" },
  { value: "saidas", label: "Saídas de hoje" },
  { value: "chegadas", label: "Chegadas" },
  { value: "manutencao", label: "Manutenção" },
];

const NEXT_ACTIONS: Record<Housekeeping, Housekeeping[]> = {
  sujo: ["limpo", "manutencao"],
  limpo: ["sujo", "manutencao"],
  manutencao: ["sujo", "limpo"],
};

const BUTTON: Record<Housekeeping, string> = {
  limpo: "btn-primary",
  sujo: "btn-secondary",
  manutencao: "btn-secondary",
};

const ACTION_LABEL: Record<Housekeeping, string> = {
  limpo: "Marcar limpo",
  sujo: "Precisa limpar",
  manutencao: "Manutenção",
};

export default async function RoomsPage({ searchParams }: PageProps<"/quartos">) {
  const { supabase, profile } = await requireUser();
  const sp = await searchParams;
  const filter = typeof sp.filtro === "string" ? sp.filtro : "";
  const today = todayISO();
  const all = await loadRoomMap(supabase, today);

  // Ordem de trabalho: primeiro quem tem chegada e está sujo, depois os demais sujos
  const priority = (s: (typeof all)[number]) =>
    (s.housekeeping === "sujo" ? 0 : 2) + (s.situation === "chegada" ? 0 : 1);

  const states = all
    .filter((s) => {
      if (filter === "sujo") return s.housekeeping === "sujo";
      if (filter === "manutencao") return s.housekeeping === "manutencao";
      if (filter === "saidas") return s.situation === "saida" || s.situation === "atrasada";
      if (filter === "chegadas") return s.situation === "chegada";
      return true;
    })
    .sort((a, b) => (filter === "sujo" ? priority(a) - priority(b) : 0));

  const dirtyWithArrival = all.filter((s) => s.housekeeping === "sujo" && s.situation === "chegada").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Quartos e governança</h1>
        <p className="text-sm text-stone-500">
          {formatDate(today)} · {all.filter((s) => s.housekeeping === "sujo").length} para limpar
          {dirtyWithArrival > 0 && (
            <span className="ml-1 font-medium text-amber-700">
              ({dirtyWithArrival} com hóspede chegando hoje: prioridade)
            </span>
          )}
        </p>
      </div>

      <nav className="mb-4 flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/quartos?filtro=${f.value}` : "/quartos"}
            className={`rounded-full px-3 py-1 font-medium ring-1 ring-inset ${
              filter === f.value ? "bg-brand text-white ring-brand" : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {states.length === 0 ? (
        <p className="card p-6 text-sm text-stone-500">Nenhum quarto neste filtro.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {states.map((s) => (
            <RoomCard key={s.room.id} state={s} linkToStay={isFront(profile.role)}>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-200/70 pt-3">
                {NEXT_ACTIONS[s.housekeeping].map((h) => (
                  <ActionForm key={h} action={setHousekeeping} className="flex flex-col">
                    <input type="hidden" name="id" value={s.room.id} />
                    <input type="hidden" name="housekeeping" value={h} />
                    <button className={`${BUTTON[h]} px-3 py-1.5 text-xs`}>{ACTION_LABEL[h]}</button>
                  </ActionForm>
                ))}
              </div>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-stone-500">Observação</summary>
                <ActionForm action={setHousekeeping} className="mt-2 flex gap-2">
                  <input type="hidden" name="id" value={s.room.id} />
                  <input type="hidden" name="housekeeping" value={s.housekeeping} />
                  <input
                    name="notes"
                    defaultValue={s.room.notes}
                    placeholder="Ex.: chuveiro com defeito"
                    className="input py-1 text-xs"
                    aria-label={`Observação do quarto ${s.room.number}`}
                  />
                  <button className="btn-secondary px-2 py-1 text-xs">Salvar</button>
                </ActionForm>
              </details>
            </RoomCard>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-stone-500">
        Situações: {HOUSEKEEPING.map((h) => HOUSEKEEPING_LABEL[h]).join(" · ")}. Após o check-out o quarto vai
        automaticamente para &ldquo;Para limpar&rdquo;. O check-in só é liberado com o quarto limpo.
      </p>
    </div>
  );
}
