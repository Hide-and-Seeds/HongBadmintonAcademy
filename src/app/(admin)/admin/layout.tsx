import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette";
import { NotificationBellServer } from "@/components/notification-bell-server";
import { ADMIN_NAV } from "@/lib/constants";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("admin");
  // Branch-admins don't see super-only items (branches, staff, settings, fee
  // plans); empty groups (e.g. Organization) drop out entirely.
  const isSuper = profile.role === "super_admin";
  const groups = ADMIN_NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => isSuper || !i.superOnly) }))
    .filter((g) => g.items.length > 0);
  return (
    <AppShell
      groups={groups}
      role={profile.role}
      name={profile.full_name ?? profile.email ?? "Admin"}
      accountHref="/admin/account"
      bell={<NotificationBellServer />}
    >
      <CommandPalette />
      {children}
    </AppShell>
  );
}
