"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  teal: "bg-teal-500",
};

export function ProfileTile({
  childId,
  nickname,
  ageLabel,
  color,
}: {
  childId: string;
  nickname: string;
  ageLabel: string;
  color: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    const res = await fetch("/api/auth/enter-child", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childId }),
    });
    if (res.ok) {
      router.push("/feed");
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={enter}
      disabled={busy}
      className="group flex w-28 flex-col items-center gap-2 disabled:opacity-50"
    >
      <span
        className={`flex h-24 w-24 items-center justify-center rounded-2xl text-4xl font-bold text-white shadow-lg transition group-hover:scale-105 ${COLOR_CLASSES[color] ?? "bg-blue-500"}`}
      >
        {nickname.charAt(0).toUpperCase()}
      </span>
      <span className="font-semibold text-white">{nickname}</span>
      <span className="text-xs text-slate-400">{ageLabel}</span>
    </button>
  );
}

export function ParentTile() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/dashboard")}
      className="group flex w-28 flex-col items-center gap-2"
    >
      <span className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-slate-500 text-4xl transition group-hover:scale-105 group-hover:border-slate-300">
        🔒
      </span>
      <span className="font-semibold text-slate-300">Parent area</span>
    </button>
  );
}
