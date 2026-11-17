export type Role = "pendente" | "recepcao" | "governanca" | "admin";
export type PropertyKind = "pousada" | "hotel";
export type Housekeeping = "limpo" | "sujo" | "manutencao";
export type ReservationStatus = "confirmada" | "hospedado" | "finalizada" | "cancelada" | "no_show";
export type ProductCategory = "frigobar" | "restaurante" | "servico";
export type PaymentMethod = "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "transferencia";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  created_at: string;
};

export type Settings = {
  id: number;
  property_name: string;
  property_kind: PropertyKind;
  checkin_time: string;
  checkout_time: string;
  phone: string;
  address: string;
};

export type RoomType = {
  id: number;
  name: string;
  capacity: number;
  base_rate: number;
  description: string;
  active: boolean;
};

export type Room = {
  id: number;
  number: string;
  room_type_id: number;
  floor: string;
  housekeeping: Housekeeping;
  notes: string;
  active: boolean;
  updated_at: string;
};

export type Guest = {
  id: number;
  full_name: string;
  document: string;
  phone: string;
  email: string;
  birth_date: string | null;
  city: string;
  notes: string;
  created_at: string;
};

export type Reservation = {
  id: number;
  guest_id: number;
  room_id: number;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  daily_rate: number;
  status: ReservationStatus;
  source: string;
  notes: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: number;
  name: string;
  category: ProductCategory;
  price: number;
  active: boolean;
};

export type Charge = {
  id: number;
  reservation_id: number;
  product_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_by: string | null;
  created_at: string;
};

export type Payment = {
  id: number;
  reservation_id: number;
  amount: number;
  method: PaymentMethod;
  notes: string;
  created_by: string | null;
  created_at: string;
};

export type ReservationTotals = {
  reservation_id: number;
  nights: number;
  lodging_total: number;
  charges_total: number;
  payments_total: number;
  balance: number;
};

export const ROLES: Role[] = ["pendente", "recepcao", "governanca", "admin"];

export const ROLE_LABEL: Record<Role, string> = {
  pendente: "Aguardando liberação",
  recepcao: "Recepção",
  governanca: "Governança",
  admin: "Administrador",
};

export const KIND_LABEL: Record<PropertyKind, string> = { pousada: "Pousada", hotel: "Hotel" };

export const HOUSEKEEPING: Housekeeping[] = ["limpo", "sujo", "manutencao"];
export const HOUSEKEEPING_LABEL: Record<Housekeeping, string> = {
  limpo: "Limpo",
  sujo: "Para limpar",
  manutencao: "Manutenção",
};

export const STATUS_ORDER: ReservationStatus[] = ["confirmada", "hospedado", "finalizada", "cancelada", "no_show"];
export const ACTIVE_STATUSES: ReservationStatus[] = ["confirmada", "hospedado"];
export const STATUS_LABEL: Record<ReservationStatus, string> = {
  confirmada: "Confirmada",
  hospedado: "Hospedado",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
  no_show: "Não compareceu",
};

export const CATEGORIES: ProductCategory[] = ["frigobar", "restaurante", "servico"];
export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  frigobar: "Frigobar",
  restaurante: "Restaurante",
  servico: "Serviços",
};

export const PAYMENT_METHODS: PaymentMethod[] = ["pix", "dinheiro", "cartao_credito", "cartao_debito", "transferencia"];
export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
};

export const SOURCES = ["balcao", "telefone", "whatsapp", "site", "booking", "airbnb", "agencia", "outro"] as const;
export const SOURCE_LABEL: Record<string, string> = {
  balcao: "Balcão",
  telefone: "Telefone",
  whatsapp: "WhatsApp",
  site: "Site próprio",
  booking: "Booking.com",
  airbnb: "Airbnb",
  agencia: "Agência",
  outro: "Outro",
};

/** Pode usar reservas, hóspedes e caixa. */
export function isFront(role: Role) {
  return role === "recepcao" || role === "admin";
}

// ---------------------------------------------------------------------
// Datas: o sistema trabalha com o dia no fuso de Brasília.
// Datas "puras" (entrada/saída) chegam do banco como "AAAA-MM-DD".
// ---------------------------------------------------------------------
const TZ = "America/Sao_Paulo";

export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round((Date.parse(`${checkOut}T12:00:00Z`) - Date.parse(`${checkIn}T12:00:00Z`)) / 86_400_000);
}

export function isISODate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatDayShort(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(d).replace(".", "");
  return { weekday: wd, day: iso.slice(8, 10), month: iso.slice(5, 7) };
}

export function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TZ }).format(
    new Date(iso),
  );
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatMoney(value: number | string | null | undefined) {
  return money.format(Number(value ?? 0));
}

export function formatTime(t: string) {
  return t.slice(0, 5);
}

export function nights(n: number) {
  return `${n} ${n === 1 ? "diária" : "diárias"}`;
}

/** Link para conversar com o hóspede no WhatsApp (assume Brasil se não houver DDI). */
export function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}
