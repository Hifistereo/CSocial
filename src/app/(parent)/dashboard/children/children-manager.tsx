"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AGE_BANDS,
  AGE_BAND_LABELS,
  AVATAR_COLORS,
  CATEGORIES,
  CATEGORY_LABELS,
  type AgeBand,
  type Category,
} from "@/lib/enums";

type Child = {
  id: string;
  nickname: string;
  ageBand: AgeBand;
  allowedCategories: string; // JSON array
  avatarColor: string;
};

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  teal: "bg-teal-500",
};

export function ChildrenManager() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<Child | "new" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/parent/children");
      if (cancelled) return;
      if (res.ok) {
        const data = (await res.json()) as { children: Child[] };
        if (!cancelled) setChildren(data.children);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  async function remove(child: Child) {
    if (
      !window.confirm(
        `Delete ${child.nickname}'s profile? Their watch history and favorites will be removed too.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/parent/children/${child.id}`, {
      method: "DELETE",
    });
    if (res.ok) load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Children</h1>
        <button
          onClick={() => setEditing("new")}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Add child
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading…</p>
      ) : children.length === 0 && editing === null ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-slate-600">
            Create a profile for each child. They&apos;ll pick it from the
            profile screen — no password needed.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {children.map((child) => (
            <li
              key={child.id}
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold text-white ${COLOR_CLASSES[child.avatarColor] ?? "bg-blue-500"}`}
              >
                {child.nickname.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">
                  {child.nickname}
                </div>
                <div className="text-sm text-slate-500">
                  Ages {AGE_BAND_LABELS[child.ageBand]} ·{" "}
                  {(JSON.parse(child.allowedCategories) as Category[])
                    .map((c) => CATEGORY_LABELS[c])
                    .join(", ")}
                </div>
              </div>
              <button
                onClick={() => setEditing(child)}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Edit
              </button>
              <button
                onClick={() => remove(child)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <ChildForm
          child={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ChildForm({
  child,
  onClose,
  onSaved,
}: {
  child: Child | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nickname, setNickname] = useState(child?.nickname ?? "");
  const [ageBand, setAgeBand] = useState<AgeBand>(child?.ageBand ?? "AGE_7_9");
  const [avatarColor, setAvatarColor] = useState(child?.avatarColor ?? "blue");
  const [categories, setCategories] = useState<Category[]>(
    child
      ? (JSON.parse(child.allowedCategories) as Category[])
      : ["EDUCATION", "ANIMALS", "MUSIC", "STORIES"]
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleCategory(cat: Category) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (categories.length === 0) {
      setError("Pick at least one category");
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      nickname,
      ageBand,
      allowedCategories: categories,
      avatarColor,
    };
    const res = child
      ? await fetch(`/api/parent/children/${child.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/parent/children", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
    setBusy(false);
    if (res.ok) {
      onSaved();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save");
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-slate-900">
          {child ? `Edit ${child.nickname}` : "New child profile"}
        </h2>

        <label className="mt-4 flex flex-col gap-1 text-sm font-medium text-slate-700">
          Nickname
          <input
            type="text"
            required
            maxLength={30}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="No real name needed"
            className="rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <label className="mt-4 flex flex-col gap-1 text-sm font-medium text-slate-700">
          Age group
          <select
            value={ageBand}
            onChange={(e) => setAgeBand(e.target.value as AgeBand)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            {AGE_BANDS.map((band) => (
              <option key={band} value={band}>
                Ages {AGE_BAND_LABELS[band]}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 text-sm font-medium text-slate-700">
          Allowed categories
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                categories.includes(cat)
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="mt-4 text-sm font-medium text-slate-700">Color</div>
        <div className="mt-2 flex gap-2">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setAvatarColor(color)}
              aria-label={color}
              className={`h-8 w-8 rounded-full ${COLOR_CLASSES[color]} ${
                avatarColor === color
                  ? "ring-2 ring-slate-900 ring-offset-2"
                  : ""
              }`}
            />
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
