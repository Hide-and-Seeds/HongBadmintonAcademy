import { redirect } from "next/navigation";
import { getParentIdFromCookie } from "@/lib/parent-auth";
import { PinSetupForm } from "./pin-setup-form";

export const dynamic = "force-dynamic";

// Reached right after a one-time login link is consumed and the parent has no
// PIN yet. Asks them to pick a 4-digit PIN they'll remember.
export default async function ParentPinSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const pid = await getParentIdFromCookie();
  if (!pid) redirect("/parent-login");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-green-600 text-4xl text-white shadow-xl">
        🏸
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Set your PIN</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick a 4-digit PIN — like an ATM card. You won&apos;t need to type a password
          again on this phone.
        </p>
      </div>
      <PinSetupForm error={error} />
    </main>
  );
}
