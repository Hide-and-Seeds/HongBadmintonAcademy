import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile, homeForRole } from "@/lib/auth";
import { TwoFactorSetup } from "@/components/two-factor-setup";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

// Forced 2FA enrollment — shown when the academy requires 2FA and this staffer
// hasn't set it up. Not under the (admin)/(coach) layout, so no guard loop.
export default async function ForceTwoFactorSetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  // Already has a factor pending → verify instead. Fully enrolled → go home.
  if (aal?.nextLevel === "aal2" && aal?.currentLevel === "aal1") redirect("/login/2fa");
  if (aal?.currentLevel === "aal2") {
    const profile = await getProfile();
    redirect(homeForRole(profile?.role ?? "admin"));
  }

  const profile = await getProfile();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-white"><ShieldCheck className="h-5 w-5" /></span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Set up two-factor</h1>
            <p className="text-xs text-slate-500">Your academy requires 2FA for staff accounts. Set it up to continue.</p>
          </div>
        </div>
        <TwoFactorSetup enrolled={false} factorId={null} />
        <div className="mt-4 border-t border-slate-100 pt-3">
          <SignOutButton role={profile?.role ?? "admin"} />
        </div>
      </div>
    </div>
  );
}
