import { redirect } from "next/navigation";
import { getProfile, homeForRole } from "@/lib/auth";
import { getParentIdFromCookie } from "@/lib/parent-auth";

// Role router: sends each signed-in user to their area.
export default async function Home() {
  // Parents use the custom cookie session (no Supabase auth row).
  const parentId = await getParentIdFromCookie();
  if (parentId) redirect("/parent");

  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(homeForRole(profile.role));
}
