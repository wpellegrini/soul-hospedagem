"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { dbError, int, money, text, type FormState } from "@/lib/form";
import { CATEGORIES, ROLES, type ProductCategory, type PropertyKind, type Role } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

export async function updateRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const role = text(formData, "role") as Role;
  if (!ROLES.includes(role)) return { error: "Perfil inválido." };

  const { error } = await supabase.from("profiles").update({ role }).eq("id", text(formData, "id"));
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: "Perfil atualizado." };
}

// ---------- Tipos de quarto ----------
function roomTypeFields(formData: FormData) {
  return {
    name: text(formData, "name"),
    capacity: int(formData, "capacity"),
    base_rate: money(formData, "base_rate"),
    description: text(formData, "description"),
  };
}

function checkRoomType(f: ReturnType<typeof roomTypeFields>) {
  if (f.name.length < 2) return "Informe o nome do tipo.";
  if (!(f.capacity >= 1 && f.capacity <= 20)) return "Capacidade entre 1 e 20 pessoas.";
  if (!(f.base_rate >= 0)) return "Diária inválida.";
  return null;
}

export async function createRoomType(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const f = roomTypeFields(formData);
  const invalid = checkRoomType(f);
  if (invalid) return { error: invalid };
  const { error } = await supabase.from("room_types").insert(f);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: `Tipo "${f.name}" criado.` };
}

export async function updateRoomType(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const f = roomTypeFields(formData);
  const invalid = checkRoomType(f);
  if (invalid) return { error: invalid };
  const { error } = await supabase
    .from("room_types")
    .update({ ...f, active: formData.get("active") === "on" })
    .eq("id", int(formData, "id"));
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: "Salvo." };
}

// ---------- Quartos ----------
export async function createRoom(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const number = text(formData, "number");
  const roomTypeId = int(formData, "room_type_id");
  if (!number) return { error: "Informe o número/nome do quarto." };
  if (!roomTypeId) return { error: "Escolha o tipo." };
  const { error } = await supabase
    .from("rooms")
    .insert({ number, room_type_id: roomTypeId, floor: text(formData, "floor") });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: `Quarto ${number} criado.` };
}

export async function updateRoom(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const number = text(formData, "number");
  if (!number) return { error: "Informe o número/nome do quarto." };
  const { error } = await supabase
    .from("rooms")
    .update({
      number,
      room_type_id: int(formData, "room_type_id"),
      floor: text(formData, "floor"),
      active: formData.get("active") === "on",
    })
    .eq("id", int(formData, "id"));
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: "Salvo." };
}

// ---------- Produtos ----------
export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const name = text(formData, "name");
  const category = text(formData, "category") as ProductCategory;
  const price = money(formData, "price");
  if (name.length < 2) return { error: "Informe o nome do produto." };
  if (!CATEGORIES.includes(category)) return { error: "Categoria inválida." };
  if (!(price >= 0)) return { error: "Preço inválido." };
  const { error } = await supabase.from("products").insert({ name, category, price });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: `"${name}" cadastrado.` };
}

export async function updateProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const name = text(formData, "name");
  const category = text(formData, "category") as ProductCategory;
  const price = money(formData, "price");
  if (name.length < 2) return { error: "Informe o nome do produto." };
  if (!CATEGORIES.includes(category)) return { error: "Categoria inválida." };
  if (!(price >= 0)) return { error: "Preço inválido." };
  const { error } = await supabase
    .from("products")
    .update({ name, category, price, active: formData.get("active") === "on" })
    .eq("id", int(formData, "id"));
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: "Salvo." };
}

// ---------- Configurações ----------
export async function updateSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const propertyName = text(formData, "property_name");
  const kind = text(formData, "property_kind") as PropertyKind;
  const checkin = text(formData, "checkin_time");
  const checkout = text(formData, "checkout_time");
  if (propertyName.length < 2) return { error: "Informe o nome do estabelecimento." };
  if (kind !== "pousada" && kind !== "hotel") return { error: "Tipo inválido." };
  if (!/^\d{2}:\d{2}$/.test(checkin) || !/^\d{2}:\d{2}$/.test(checkout)) return { error: "Horários inválidos." };

  const { error } = await supabase
    .from("settings")
    .update({
      property_name: propertyName,
      property_kind: kind,
      checkin_time: checkin,
      checkout_time: checkout,
      phone: text(formData, "phone"),
      address: text(formData, "address"),
    })
    .eq("id", 1);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: "Configurações salvas." };
}
