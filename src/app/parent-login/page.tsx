import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Login is unified at /login now. Keep this path alive for old bookmarks, the
// install QR and admin login links — forward to the single sign-in page.
export default async function ParentLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
}
