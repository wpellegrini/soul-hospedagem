import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { CATEGORIES, CATEGORY_LABEL, type Product } from "@/lib/types";
import ActionForm from "@/components/action-form";
import { createProduct, updateProduct } from "../actions";

export const metadata: Metadata = { title: "Produtos e serviços" };

export default async function AdminProductsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("products").select("*").order("category").order("name").returns<Product[]>();
  const products = data ?? [];

  return (
    <div>
      <p className="mb-4 text-sm text-stone-500">
        Itens do frigobar, restaurante e serviços cobrados à parte. Mudar o preço não altera o que já foi lançado.
      </p>
      <div className="card divide-y divide-stone-100">
        {products.map((p) => (
          <ActionForm key={p.id} action={updateProduct} className="grid items-end gap-2 px-4 py-3 sm:grid-cols-[2fr_1fr_8rem_auto_auto]">
            <input type="hidden" name="id" value={p.id} />
            <input name="name" defaultValue={p.name} className="input" aria-label="Nome" />
            <select name="category" defaultValue={p.category} className="input" aria-label="Categoria">
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
            <input name="price" inputMode="decimal" defaultValue={Number(p.price).toFixed(2).replace(".", ",")} className="input" aria-label="Preço" />
            <label className="flex items-center gap-2 pb-2 text-sm text-stone-600">
              <input type="checkbox" name="active" defaultChecked={p.active} className="h-4 w-4 accent-emerald-700" /> Ativo
            </label>
            <button className="btn-secondary">Salvar</button>
          </ActionForm>
        ))}
        <ActionForm action={createProduct} className="grid items-end gap-2 bg-stone-50 px-4 py-3 sm:grid-cols-[2fr_1fr_8rem_auto]">
          <input name="name" placeholder="Novo produto ou serviço" className="input" required aria-label="Nome do novo produto" />
          <select name="category" defaultValue="frigobar" className="input" aria-label="Categoria do novo produto">
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <input name="price" inputMode="decimal" placeholder="Preço" className="input" required aria-label="Preço do novo produto" />
          <button className="btn-primary">Adicionar</button>
        </ActionForm>
      </div>
    </div>
  );
}
