import Link from "next/link";

export default function ClubThanksPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-5 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
      <h1 className="text-2xl font-bold text-slate-900">Welcome to the club!</h1>
      <p className="max-w-sm text-sm text-slate-500">
        Thanks for joining. Once your payment clears, your membership is active — we&apos;ll be in touch by email with the details.
      </p>
      <Link href="/club" className="text-sm font-medium text-emerald-700 hover:underline">Back to the club</Link>
    </main>
  );
}
