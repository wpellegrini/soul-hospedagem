import Link from "next/link";
import { getSettings, homeFor, requireUser } from "@/lib/auth";
import { isFront, KIND_LABEL, ROLE_LABEL } from "@/lib/types";
import NavLinks from "@/components/nav-links";
import { signOut } from "@/app/login/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile } = await requireUser();
  const settings = await getSettings();

  const links: { href: string; label: string }[] = [];
  if (isFront(profile.role)) {
    links.push(
      { href: "/painel", label: "Painel" },
      { href: "/agenda", label: "Agenda" },
      { href: "/reservas", label: "Reservas" },
      { href: "/hospedes", label: "Hóspedes" },
    );
  }
  links.push({ href: "/quartos", label: "Quartos" }, { href: "/consumo", label: "Consumo" });
  if (profile.role === "admin") links.push({ href: "/admin", label: "Administração" });

  const initials = settings.property_name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen">
      <header className="bg-brand text-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href={homeFor(profile.role)} className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-white/15 text-xs font-bold">
              {initials}
            </span>
            <span className="leading-tight">
              {settings.property_name}
              <span className="block text-[11px] font-normal text-emerald-100/70">
                {KIND_LABEL[settings.property_kind]}
              </span>
            </span>
          </Link>
          <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
            <NavLinks links={links} />
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <div className="text-right leading-tight">
              <div className="font-medium">{profile.full_name || profile.email}</div>
              <div className="text-xs text-emerald-100/70">{ROLE_LABEL[profile.role]}</div>
            </div>
            <form action={signOut}>
              <button className="rounded-md border border-white/25 px-3 py-1.5 text-xs font-medium hover:bg-white/10">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
