"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS, type Category } from "@/lib/enums";

type Flag = {
  id: string;
  type: "MORE_LIKE_THIS" | "REPORT";
  createdAt: string;
  childNickname: string;
  video: {
    id: string;
    title: string;
    channelName: string;
    thumbnailUrl: string;
    category: Category;
    status: string;
  };
};

type WatchEvent = {
  id: string;
  childId: string;
  childNickname: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  watchedAt: string;
  secondsWatched: number;
  completed: boolean;
};

type Child = { id: string; nickname: string };

export function ActivityView() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [childFilter, setChildFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const query = childFilter ? `?childId=${childFilter}` : "";
      const [flagsRes, eventsRes, childrenRes] = await Promise.all([
        fetch("/api/parent/flags"),
        fetch(`/api/parent/activity${query}`),
        fetch("/api/parent/children"),
      ]);
      if (cancelled) return;
      if (flagsRes.ok) setFlags((await flagsRes.json()).flags);
      if (eventsRes.ok) setEvents((await eventsRes.json()).events);
      if (childrenRes.ok) setChildren((await childrenRes.json()).children);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [childFilter, reloadKey]);

  async function resolveFlag(id: string) {
    const res = await fetch(`/api/parent/flags/${id}/resolve`, {
      method: "POST",
    });
    if (res.ok) setReloadKey((k) => k + 1);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">Activity</h1>

      <section className="mt-4">
        <h2 className="font-semibold text-slate-800">Requests from kids</h2>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : flags.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Nothing waiting — when a child taps “More please” or “Don&apos;t
            like”, it shows up here.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {flags.map((flag) => (
              <li
                key={flag.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={flag.video.thumbnailUrl}
                  alt=""
                  className="h-14 w-24 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <span className="font-semibold text-slate-900">
                      {flag.childNickname}
                    </span>{" "}
                    {flag.type === "MORE_LIKE_THIS" ? (
                      <span className="text-indigo-700">
                        wants more like this ✨
                      </span>
                    ) : (
                      <span className="text-red-700">
                        didn&apos;t like this 👎
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm text-slate-600">
                    {flag.video.title}
                  </div>
                  <div className="text-xs text-slate-400">
                    {CATEGORY_LABELS[flag.video.category]} ·{" "}
                    {flag.video.channelName}
                  </div>
                </div>
                <button
                  onClick={() => resolveFlag(flag.id)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  Done
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Watch history</h2>
          <select
            value={childFilter}
            onChange={(e) => {
              setLoading(true);
              setChildFilter(e.target.value);
            }}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            aria-label="Filter by child"
          >
            <option value="">All children</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : events.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No watch history yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.thumbnailUrl}
                  alt=""
                  className="h-12 w-20 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {event.title}
                  </div>
                  <div className="text-xs text-slate-500">
                    {event.childNickname} ·{" "}
                    {new Date(event.watchedAt).toLocaleString()} ·{" "}
                    {Math.round(event.secondsWatched / 60)} min
                    {event.completed ? " · finished" : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
