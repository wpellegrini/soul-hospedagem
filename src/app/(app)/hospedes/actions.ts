"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFront } from "@/lib/auth";
import { dbError, int, text, type FormState } from "@/lib/form";
import { isISODate } from "@/lib/types";

function guestFields(formData: FormData) {
  const birth = text(formData, "birth_date");
  return {
    full_name: text(formData, "full_name"),
    document: text(formData, "document"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    city: text(formData, "city"),
    birth_date: isISODate(birth) ? birth : null,
    notes: text(formData, "notes"),
  };
}

export async function createGuest(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireFront();
  const fields = guestFields(formData);
  if (fields.full_name.length < 3) return { error: "Informe o nome completo." };

  const { data, error } = await supabase.from("guests").insert(fields).select("id").single();
  if (error) return { error: dbError(error) };
  revalidatePath("/hospedes");
  redirect(`/hospedes/${data.id}`);
}

export async function updateGuest(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireFront();
  const fields = guestFields(formData);
  if (fields.full_name.length < 3) return { error: "Informe o nome completo." };

  const { error } = await supabase.from("guests").update(fields).eq("id", int(formData, "id"));
  if (error) return { error: dbError(error) };
  revalidatePath("/", "layout");
  return { ok: "Cadastro atualizado." };
}
