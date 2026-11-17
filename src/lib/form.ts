export type FormState = { error?: string; ok?: string };

export function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function int(formData: FormData, key: string) {
  const n = Number(text(formData, key));
  return Number.isInteger(n) ? n : NaN;
}

/** Aceita "1.234,56", "1234,56" e "1234.56". */
export function money(formData: FormData, key: string) {
  const raw = text(formData, key).replace(/\s|R\$/g, "");
  if (!raw) return NaN;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Math.round(Number(normalized) * 100) / 100;
}

/** Mensagem amigável para os erros do banco. */
export function dbError(error: { code?: string; message: string }) {
  if (error.code === "23P01") return "Este quarto já está reservado em parte desse período.";
  if (error.code === "23505") return "Já existe um cadastro com esses dados (nome, número ou documento).";
  if (error.code === "23514") return "Algum valor está fora do permitido. Confira os campos.";
  if (error.code === "42501") return "Você não tem permissão para fazer isso.";
  return error.message;
}
