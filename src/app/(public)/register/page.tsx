"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pin && !/^\d{4,6}$/.test(pin)) {
      setError("PIN must be 4–6 digits");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, pin: pin || undefined }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/dashboard/children");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Registration failed");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-indigo-50 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900">
          Create a family account
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          You (the parent) manage everything. Kids only ever see videos you
          approve.
        </p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none"
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Password (8+ characters)
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none"
              autoComplete="new-password"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Parent PIN (4–6 digits, optional)
            <input
              type="text"
              inputMode="numeric"
              placeholder="Quick unlock for the parent area"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-indigo-600">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
