"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function SettingsView({
  email,
  hasPin,
  watchRetentionDays,
}: {
  email: string;
  hasPin: boolean;
  watchRetentionDays: number;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [retention, setRetention] = useState(watchRetentionDays);
  const [retentionMessage, setRetentionMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [busy, setBusy] = useState(false);

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    setPinMessage(null);
    const res = await fetch("/api/parent/pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json().catch(() => ({}));
    setPinMessage(res.ok ? "PIN updated." : (data.error ?? "Could not save PIN"));
    if (res.ok) setPin("");
  }

  async function saveRetention(e: React.FormEvent) {
    e.preventDefault();
    setRetentionMessage(null);
    const res = await fetch("/api/parent/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ watchRetentionDays: retention }),
    });
    setRetentionMessage(res.ok ? "Saved." : "Could not save");
  }

  async function deleteAccount() {
    setBusy(true);
    const res = await fetch("/api/parent/account", { method: "DELETE" });
    if (res.ok) {
      router.push("/login");
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Signed in as {email}</p>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Parent PIN</h2>
        <p className="mt-1 text-sm text-slate-500">
          {hasPin
            ? "Used to unlock the parent area and leave kid mode."
            : "You haven't set a PIN — your password is used instead. A short PIN is quicker on a shared device."}
        </p>
        <form onSubmit={savePin} className="mt-3 flex gap-2">
          <input
            type="password"
            inputMode="numeric"
            placeholder="New 4–6 digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            minLength={4}
            maxLength={6}
            required
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Save PIN
          </button>
        </form>
        {pinMessage && <p className="mt-2 text-sm text-slate-600">{pinMessage}</p>}
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Watch history retention</h2>
        <p className="mt-1 text-sm text-slate-500">
          Watch history older than this is deleted automatically.
        </p>
        <form onSubmit={saveRetention} className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={365}
            value={retention}
            onChange={(e) => setRetention(Number(e.target.value))}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            aria-label="Retention days"
          />
          <span className="text-sm text-slate-600">days</span>
          <button className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Save
          </button>
        </form>
        {retentionMessage && (
          <p className="mt-2 text-sm text-slate-600">{retentionMessage}</p>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-red-200 bg-white p-5">
        <h2 className="font-semibold text-red-700">Delete account</h2>
        <p className="mt-1 text-sm text-slate-500">
          Permanently removes your account, all child profiles, the video
          library, watch history and logs. This cannot be undone. See the{" "}
          <Link href="/privacy" className="underline">
            privacy notice
          </Link>
          .
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder='Type "DELETE" to confirm'
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
          />
          <button
            onClick={deleteAccount}
            disabled={confirmDelete !== "DELETE" || busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </section>
    </div>
  );
}
