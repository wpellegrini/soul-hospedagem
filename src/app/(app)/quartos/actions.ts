"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { dbError, int, text, type FormState } from "@/lib/form";
import { HOUSEKEEPING, HOUSEKEEPING_LABEL, type Housekeeping } from "@/lib/types";

/** Governança: marca o quarto como limpo, para limpar ou em manutenção. */
export async function setHousekeeping(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const value = text(formData, "housekeeping") as Housekeeping;
  if (!HOUSEKEEPING.includes(value)) return { error: "Situação inválida." };

  const update: Record<string, string> = { housekeeping: value };
  if (formData.has("notes")) update.notes = text(formData, "notes");

  const { error } = await supabase.from("rooms").update(update).eq("id", int(formData, "id"));
  if (error) return { error: dbError(error) };
  revalidatePath("/", "layout");
  return { ok: HOUSEKEEPING_LABEL[value] };
}
