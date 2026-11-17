"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireFront, requireUser } from "@/lib/auth";
import { dbError, int, money, text, type FormState } from "@/lib/form";
import { isISODate, PAYMENT_METHODS, SOURCES, type PaymentMethod } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

/** Nova reserva (com cadastro rápido do hóspede, se for novo). */
export async function createReservation(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireFront();

  const roomId = int(formData, "room_id");
  const checkIn = text(formData, "check_in");
  const checkOut = text(formData, "check_out");
  const adults = int(formData, "adults");
  const children = int(formData, "children") || 0;
  const rateRaw = text(formData, "daily_rate");
  const dailyRate = rateRaw ? money(formData, "daily_rate") : null;
  const source = text(formData, "source");
  const notes = text(formData, "notes");
  const checkInNow = formData.get("checkin_now") === "on";

  if (!roomId) return { error: "Escolha o quarto." };
  if (!isISODate(checkIn) || !isISODate(checkOut)) return { error: "Informe as datas de entrada e saída." };
  if (checkOut <= checkIn) return { error: "A saída precisa ser depois da entrada." };
  if (!(adults >= 1)) return { error: "Informe ao menos 1 adulto." };
  if (dailyRate !== null && !(dailyRate >= 0)) return { error: "Valor da diária inválido." };
  if (!SOURCES.includes(source as (typeof SOURCES)[number])) return { error: "Origem inválida." };

  // Hóspede: existente ou novo
  let guestId = int(formData, "guest_id");
  if (text(formData, "guest_mode") === "novo") {
    const fullName = text(formData, "guest_name");
    if (fullName.length < 3) return { error: "Informe o nome completo do hóspede." };
    const { data, error } = await supabase
      .from("guests")
      .insert({
        full_name: fullName,
        document: text(formData, "guest_document"),
        phone: text(formData, "guest_phone"),
        email: text(formData, "guest_email"),
      })
      .select("id")
      .single();
    if (error) return { error: dbError(error) };
    guestId = data.id;
  }
  if (!guestId) return { error: "Escolha o hóspede." };

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      guest_id: guestId,
      room_id: roomId,
      check_in: checkIn,
      check_out: checkOut,
      adults,
      children,
      daily_rate: dailyRate,
      source,
      notes,
    })
    .select("id")
    .single();
  if (error) return { error: dbError(error) };

  let aviso = "";
  if (checkInNow) {
    const { error: ciError } = await supabase
      .from("reservations")
      .update({ status: "hospedado" })
      .eq("id", data.id);
    if (ciError) aviso = `?aviso=${encodeURIComponent(`Reserva criada, mas o check-in não foi feito: ${dbError(ciError)}`)}`;
  }

  refresh();
  redirect(`/reservas/${data.id}${aviso}`);
}

const TRANSITIONS: Record<string, string> = {
  hospedado: "Check-in realizado. Boa estadia!",
  finalizada: "Check-out realizado. O quarto foi enviado para a limpeza.",
  cancelada: "Reserva cancelada.",
  no_show: "Reserva marcada como não comparecimento.",
};

/** Check-in, check-out, cancelamento e não comparecimento. */
export async function changeStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireFront();
  const id = int(formData, "id");
  const status = text(formData, "status");
  if (!TRANSITIONS[status]) return { error: "Ação inválida." };

  const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: TRANSITIONS[status] };
}

/** Alterar datas, quarto, pessoas, diária e observações. */
export async function updateReservation(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireFront();
  const id = int(formData, "id");
  const checkIn = text(formData, "check_in");
  const checkOut = text(formData, "check_out");
  const adults = int(formData, "adults");
  const children = int(formData, "children") || 0;
  const dailyRate = money(formData, "daily_rate");

  if (!isISODate(checkIn) || !isISODate(checkOut)) return { error: "Datas inválidas." };
  if (checkOut <= checkIn) return { error: "A saída precisa ser depois da entrada." };
  if (!(adults >= 1)) return { error: "Informe ao menos 1 adulto." };
  if (!(dailyRate >= 0)) return { error: "Valor da diária inválido." };

  const { error } = await supabase
    .from("reservations")
    .update({
      room_id: int(formData, "room_id"),
      check_in: checkIn,
      check_out: checkOut,
      adults,
      children,
      daily_rate: dailyRate,
      notes: text(formData, "notes"),
    })
    .eq("id", id);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: "Reserva atualizada." };
}

/** Lançar consumo: produto do cadastro ou lançamento avulso (recepção). */
export async function addCharge(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const reservationId = int(formData, "reservation_id");
  const quantity = int(formData, "quantity") || 1;
  const productId = int(formData, "product_id");

  const row: Record<string, unknown> = { reservation_id: reservationId, quantity };
  if (productId) {
    row.product_id = productId;
  } else {
    const description = text(formData, "description");
    const price = money(formData, "unit_price");
    if (description.length < 2) return { error: "Descreva o lançamento." };
    if (!(price >= 0)) return { error: "Informe o valor." };
    row.description = description;
    row.unit_price = price;
  }
  if (quantity < 1 || quantity > 999) return { error: "Quantidade inválida." };

  const { error } = await supabase.from("charges").insert(row);
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: "Consumo lançado." };
}

/** Conferência do frigobar: vários produtos de uma vez. */
export async function addChargesBatch(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const reservationId = int(formData, "reservation_id");
  if (!reservationId) return { error: "Escolha o quarto." };

  const rows: { reservation_id: number; product_id: number; quantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("qty_")) continue;
    const quantity = Number(value);
    if (Number.isInteger(quantity) && quantity > 0) {
      rows.push({ reservation_id: reservationId, product_id: Number(key.slice(4)), quantity });
    }
  }
  if (!rows.length) return { error: "Informe a quantidade de pelo menos um item." };

  const { error } = await supabase.from("charges").insert(rows);
  if (error) return { error: dbError(error) };
  refresh();
  const total = rows.reduce((s, r) => s + r.quantity, 0);
  return { ok: `${total} ${total === 1 ? "item lançado" : "itens lançados"} na conta do hóspede.` };
}

export async function removeCharge(formData: FormData) {
  const { supabase } = await requireFront();
  await supabase.from("charges").delete().eq("id", int(formData, "id"));
  refresh();
}

export async function addPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireFront();
  const amount = money(formData, "amount");
  const method = text(formData, "method") as PaymentMethod;
  if (!(amount > 0)) return { error: "Informe um valor maior que zero." };
  if (!PAYMENT_METHODS.includes(method)) return { error: "Forma de pagamento inválida." };

  const { error } = await supabase.from("payments").insert({
    reservation_id: int(formData, "reservation_id"),
    amount,
    method,
    notes: text(formData, "notes"),
  });
  if (error) return { error: dbError(error) };
  refresh();
  return { ok: "Pagamento registrado." };
}

export async function removePayment(formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("payments").delete().eq("id", int(formData, "id"));
  refresh();
}
