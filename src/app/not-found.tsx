import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
      <div className="text-5xl">🏸</div>
      <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="max-w-sm text-sm text-slate-500">
        That page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link href="/" className={buttonClass("primary")}>Go home</Link>
    </main>
  );
}
