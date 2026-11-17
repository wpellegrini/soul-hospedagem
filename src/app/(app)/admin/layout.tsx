import { requireAdmin } from "@/lib/auth";
import AdminTabs from "./tabs";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-stone-900">Administração</h1>
      <AdminTabs />
      {children}
    </div>
  );
}
