import { Feather } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";
import { Button, Card, Field, Input } from "@/components/ui";
import { signIn } from "./actions";

export const dynamic = "force-dynamic";

// Single sign-in for staff and parents — the action routes by role.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-green-600 text-white">
            <Feather className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">{APP_NAME}</h1>
          <p className="text-sm text-slate-500">Sign in</p>
        </div>

        {!configured && (
          <div className="mb-4 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            Supabase is not configured yet. Add your project URL and keys to <code>.env.local</code>, then restart.
          </div>
        )}

        <form action={signIn} className="space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="Email" required>
            <Input type="email" name="email" required autoComplete="email" />
          </Field>
          <Field label="Password" required>
            <Input type="password" name="password" required autoComplete="current-password" />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={!configured}>
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-xs">
          <a href="/parent-login/forgot" className="font-medium text-green-700 hover:underline">
            Forgot password?
          </a>
        </p>
      </Card>
    </main>
  );
}
