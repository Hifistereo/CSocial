"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UnlockPage() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Incorrect PIN");
      setSecret("");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-indigo-50 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-2 text-xl font-bold text-slate-900">Parent area</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your PIN (or password if you haven&apos;t set one).
        </p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            required
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-widest focus:border-indigo-500 focus:outline-none"
            aria-label="Parent PIN"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Checking…" : "Unlock"}
          </button>
        </form>
        <button
          onClick={() => router.push("/profiles")}
          className="mt-4 text-sm text-slate-500 underline"
        >
          Back to profiles
        </button>
      </div>
    </main>
  );
}
