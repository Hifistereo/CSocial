"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AGE_BANDS,
  AGE_BAND_LABELS,
  CATEGORIES,
  CATEGORY_LABELS,
  CONTENT_STATUSES,
  type AgeBand,
  type Category,
  type ContentStatus,
} from "@/lib/enums";

type Item = {
  id: string;
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  durationSec: number | null;
  category: Category;
  ageBand: AgeBand;
  status: ContentStatus;
  createdAt: string;
};

const STATUS_LABELS: Record<ContentStatus, string> = {
  PENDING: "To review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVOKED: "Revoked",
};

export function VideosManager({
  initialStatus,
}: {
  initialStatus: ContentStatus;
}) {
  const [tab, setTabState] = useState<ContentStatus>(initialStatus);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/parent/videos?status=${tab}`);
      if (cancelled) return;
      if (res.ok) {
        const data = (await res.json()) as { items: Item[] };
        if (!cancelled) setItems(data.items);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, reloadKey]);

  const setTab = useCallback((status: ContentStatus) => {
    setLoading(true);
    setTabState(status);
  }, []);

  async function act(id: string, action: "approve" | "reject" | "revoke") {
    const res = await fetch(`/api/parent/videos/${id}/${action}`, {
      method: "POST",
    });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Something went wrong");
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">Videos</h1>

      <AddVideoForm
        onAdded={() => {
          setMessage("Video added — it's waiting in “To review”.");
          if (tab === "PENDING") setReloadKey((k) => k + 1);
        }}
      />

      {message && (
        <div
          className="mt-4 cursor-pointer rounded-lg bg-indigo-50 px-4 py-2 text-sm text-indigo-800"
          onClick={() => setMessage(null)}
        >
          {message}
        </div>
      )}

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {CONTENT_STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setTab(status)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium ${
              tab === status
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          {tab === "PENDING"
            ? "Nothing to review. Paste a YouTube link above to add a video."
            : `No ${STATUS_LABELS[tab].toLowerCase()} videos.`}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {items.map((item) => (
            <VideoCard key={item.id} item={item} onAction={act} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddVideoForm({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<Category>("EDUCATION");
  const [ageBand, setAgeBand] = useState<AgeBand>("AGE_7_9");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/parent/videos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, category, ageBand }),
    });
    setBusy(false);
    if (res.ok) {
      setUrl("");
      onAdded();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not add the video");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-xl border border-slate-200 bg-white p-4"
    >
      <label className="text-sm font-medium text-slate-700">
        Add a YouTube video
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          required
          placeholder="https://www.youtube.com/watch?v=…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
          aria-label="Category"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={ageBand}
          onChange={(e) => setAgeBand(e.target.value as AgeBand)}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
          aria-label="Age group"
        >
          {AGE_BANDS.map((band) => (
            <option key={band} value={band}>
              Ages {AGE_BAND_LABELS[band]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "Fetching…" : "Add"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}

function VideoCard({
  item,
  onAction,
}: {
  item: Item;
  onAction: (id: string, action: "approve" | "reject" | "revoke") => void;
}) {
  const [preview, setPreview] = useState(false);

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex gap-4">
        <button
          onClick={() => setPreview((p) => !p)}
          className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-slate-100"
          aria-label="Preview video"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-2xl text-white">
            ▶
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-900">
            {item.title}
          </div>
          <div className="text-sm text-slate-500">{item.channelName}</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
              {CATEGORY_LABELS[item.category]}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
              Ages {AGE_BAND_LABELS[item.ageBand]}
            </span>
            {item.durationSec != null && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                {Math.floor(item.durationSec / 60)}:
                {String(item.durationSec % 60).padStart(2, "0")}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {item.status === "PENDING" && (
            <>
              <ActionButton
                label="Approve"
                kind="primary"
                onClick={() => onAction(item.id, "approve")}
              />
              <ActionButton
                label="Reject"
                kind="danger"
                onClick={() => onAction(item.id, "reject")}
              />
            </>
          )}
          {item.status === "APPROVED" && (
            <ActionButton
              label="Revoke"
              kind="danger"
              onClick={() => onAction(item.id, "revoke")}
            />
          )}
          {(item.status === "REJECTED" || item.status === "REVOKED") && (
            <ActionButton
              label="Approve"
              kind="primary"
              onClick={() => onAction(item.id, "approve")}
            />
          )}
        </div>
      </div>
      {preview && (
        <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${item.videoId}?rel=0&modestbranding=1`}
            title={item.title}
            allow="accelerometer; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </li>
  );
}

function ActionButton({
  label,
  kind,
  onClick,
}: {
  label: string;
  kind: "primary" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
        kind === "primary"
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : "bg-red-50 text-red-700 hover:bg-red-100"
      }`}
    >
      {label}
    </button>
  );
}
