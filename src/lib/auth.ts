import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isFront, type Profile, type Settings } from "@/lib/types";

/** Usuário logado + perfil (sem exigir liberação). */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single<Profile>();
  if (!profile) redirect("/login");

  return { supabase, profile };
});

/**
 * Funcionário liberado (qualquer perfil, exceto "pendente").
 * `cache` evita repetir as consultas várias vezes na mesma requisição.
 */
export const requireUser = cache(async () => {
  const ctx = await getSession();
  if (ctx.profile.role === "pendente") redirect("/aguardando");
  return ctx;
});

export const getSettings = cache(async () => {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("settings").select("*").single<Settings>();
  return (
    data ?? {
      id: 1,
      property_name: "Hospedagem",
      property_kind: "pousada",
      checkin_time: "14:00",
      checkout_time: "12:00",
      phone: "",
      address: "",
    }
  );
});

export function homeFor(role: Profile["role"]) {
  return isFront(role) ? "/painel" : "/quartos";
}

export async function requireFront() {
  const ctx = await requireUser();
  if (!isFront(ctx.profile.role)) redirect("/quartos");
  return ctx;
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.profile.role !== "admin") redirect(homeFor(ctx.profile.role));
  return ctx;
}
