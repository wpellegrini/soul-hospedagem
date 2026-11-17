"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/quartos", label: "Quartos e tarifas" },
  { href: "/admin/produtos", label: "Produtos e serviços" },
  { href: "/admin/configuracoes", label: "Estabelecimento" },
];

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-4 overflow-x-auto border-b border-stone-200 text-sm">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 pb-2 font-medium whitespace-nowrap ${
              active ? "border-brand-600 text-stone-900" : "border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
