"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { YouTubePlayer, type PlayerHandle } from "@/components/youtube-player";

type FeedItem = {
  id: string;
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  category: string;
  isFavorite: boolean;
};

export function FeedClient({ nickname }: { nickname: string }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [started, setStarted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showExit, setShowExit] = useState(false);
  const [favoritesMode, setFavoritesMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  const loadMore = useCallback(
    async (replace = false, favorites = favoritesMode) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        const res = await fetch(
          favorites ? "/api/child/favorites" : "/api/child/feed"
        );
        if (res.ok) {
          const data = (await res.json()) as { items: FeedItem[] };
          setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
        }
      } finally {
        fetchingRef.current = false;
        setLoaded(true);
      }
    },
    [favoritesMode]
  );

  useEffect(() => {
    loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchMode(favorites: boolean) {
    setFavoritesMode(favorites);
    setActiveIndex(0);
    containerRef.current?.scrollTo({ top: 0 });
    loadMore(true, favorites);
  }

  // Observe which slide fills the viewport -> that one plays.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !started) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.index ?? 0
            );
            setActiveIndex(idx);
          }
        }
      },
      { root: container, threshold: 0.6 }
    );
    container
      .querySelectorAll("[data-index]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items.length, started]);

  // Fetch the next batch as the child approaches the end (endless feed only).
  useEffect(() => {
    if (!favoritesMode && items.length > 0 && activeIndex >= items.length - 3) {
      loadMore();
    }
  }, [activeIndex, items.length, loadMore, favoritesMode]);

  const advance = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const next = container.querySelector(
      `[data-index="${activeIndex + 1}"]`
    ) as HTMLElement | null;
    next?.scrollIntoView({ behavior: "smooth" });
  }, [activeIndex]);

  if (loaded && items.length === 0) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center">
        <div className="text-5xl">📺</div>
        <h1 className="text-xl font-bold text-white">No videos yet</h1>
        <p className="max-w-xs text-slate-400">
          Ask your parent to add and approve some videos for you!
        </p>
        <ExitCorner onExit={() => setShowExit(true)} />
        {showExit && <ExitDialog onClose={() => setShowExit(false)} />}
      </main>
    );
  }

  if (!started) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-slate-950">
        <h1 className="text-2xl font-bold text-white">Hi {nickname}! 👋</h1>
        <button
          onClick={() => setStarted(true)}
          disabled={!loaded}
          className="rounded-full bg-indigo-500 px-10 py-5 text-xl font-bold text-white shadow-lg transition hover:scale-105 disabled:opacity-50"
        >
          {loaded ? "▶ Tap to start" : "Loading…"}
        </button>
      </main>
    );
  }

  return (
    <main className="relative h-dvh bg-black">
      <div
        ref={containerRef}
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
      >
        {items.map((item, idx) => (
          <FeedSlide
            key={`${item.id}-${idx}`}
            item={item}
            index={idx}
            active={idx === activeIndex}
            onEnded={advance}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
        <span className="rounded-full bg-black/40 px-3 py-1 text-sm font-semibold text-white">
          {nickname}
        </span>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => switchMode(!favoritesMode)}
            className={`flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold ${
              favoritesMode ? "bg-pink-500 text-white" : "bg-black/40 text-white"
            }`}
            aria-label="My favorites"
          >
            ❤️ {favoritesMode ? "Favorites" : ""}
          </button>
          <ExitCorner onExit={() => setShowExit(true)} />
        </div>
      </div>
      {favoritesMode && items.length === 0 && loaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950 text-center">
          <div className="text-4xl">🤍</div>
          <p className="max-w-xs text-slate-300">
            No favorites yet — tap the heart on videos you love!
          </p>
          <button
            onClick={() => switchMode(false)}
            className="rounded-full bg-indigo-500 px-6 py-2 font-semibold text-white"
          >
            Back to videos
          </button>
        </div>
      )}
      {showExit && <ExitDialog onClose={() => setShowExit(false)} />}
    </main>
  );
}

function sendWatchEvent(
  contentItemId: string,
  secondsWatched: number,
  completed: boolean,
  useBeacon = false
) {
  const payload = JSON.stringify({
    contentItemId,
    secondsWatched: Math.round(secondsWatched),
    completed,
  });
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/child/watch-events",
      new Blob([payload], { type: "application/json" })
    );
  } else {
    fetch("/api/child/watch-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }
}

function FeedSlide({
  item,
  index,
  active,
  onEnded,
}: {
  item: FeedItem;
  index: number;
  active: boolean;
  onEnded: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [favorite, setFavorite] = useState(item.isFavorite);
  const [toast, setToast] = useState<string | null>(null);
  const playerRef = useRef<PlayerHandle | null>(null);
  const reportedRef = useRef(false);

  // Report a watch event once per activation: on completion or deactivation.
  const report = useCallback(
    (completed: boolean, useBeacon = false) => {
      if (reportedRef.current) return;
      const seconds = playerRef.current?.currentTime() ?? 0;
      if (seconds < 1 && !completed) return;
      reportedRef.current = true;
      sendWatchEvent(item.id, seconds, completed, useBeacon);
    },
    [item.id]
  );

  useEffect(() => {
    if (active) {
      reportedRef.current = false;
      const onPageHide = () => report(false, true);
      window.addEventListener("pagehide", onPageHide);
      return () => {
        window.removeEventListener("pagehide", onPageHide);
        report(false);
      };
    }
  }, [active, report]);

  async function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    await fetch("/api/child/favorites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentItemId: item.id, favorite: next }),
    });
  }

  async function flag(type: "MORE_LIKE_THIS" | "REPORT") {
    await fetch("/api/child/flags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentItemId: item.id, type }),
    });
    setToast(
      type === "MORE_LIKE_THIS"
        ? "Asked your parent for more like this 💌"
        : "Told your parent 👍"
    );
    setTimeout(() => setToast(null), 2500);
    if (type === "REPORT") onEnded(); // skip to the next video
  }

  return (
    <section
      data-index={index}
      className="relative h-dvh w-full snap-start bg-black"
    >
      {active ? (
        <YouTubePlayer
          videoId={item.videoId}
          onEnded={() => {
            report(true);
            onEnded();
          }}
          onPlayingChange={setPlaying}
          handleRef={(h) => (playerRef.current = h)}
        />
      ) : (
        // Neighbour slides show the thumbnail only — one player at a time.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnailUrl}
          alt=""
          className="h-full w-full object-cover opacity-60"
        />
      )}

      {/* Transparent overlay: blocks every tap from reaching the iframe, so
          the child can never click through to YouTube itself. */}
      <div
        className="absolute inset-0 z-10"
        onClick={() => playerRef.current?.toggle()}
      >
        {active && !playing && (
          <div className="flex h-full items-center justify-center">
            <span className="rounded-full bg-black/50 p-6 text-5xl">▶️</span>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-4 pb-6">
        <div className="max-w-[65%]">
          <div className="font-semibold text-white">{item.title}</div>
          <div className="text-sm text-white/60">{item.channelName}</div>
        </div>
        <div className="pointer-events-auto flex flex-col items-center gap-4">
          <ActionIcon
            label={favorite ? "Saved" : "Save"}
            icon={favorite ? "❤️" : "🤍"}
            onClick={toggleFavorite}
          />
          <ActionIcon
            label="More please"
            icon="✨"
            onClick={() => flag("MORE_LIKE_THIS")}
          />
          <ActionIcon
            label="Don't like"
            icon="👎"
            onClick={() => flag("REPORT")}
          />
        </div>
      </div>

      {toast && (
        <div className="absolute inset-x-0 top-16 z-30 flex justify-center">
          <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow">
            {toast}
          </span>
        </div>
      )}
    </section>
  );
}

function ActionIcon({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-white"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl backdrop-blur-sm transition active:scale-90">
        {icon}
      </span>
      <span className="text-[11px] font-medium drop-shadow">{label}</span>
    </button>
  );
}

function ExitCorner({ onExit }: { onExit: () => void }) {
  return (
    <button
      onClick={onExit}
      className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-lg"
      aria-label="Parent exit"
    >
      🔒
    </button>
  );
}

function ExitDialog({ onClose }: { onClose: () => void }) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/exit-child", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret }),
    });
    setBusy(false);
    if (res.ok) {
      window.location.href = "/profiles";
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Incorrect PIN");
      setSecret("");
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-xs rounded-2xl bg-white p-6 text-center"
      >
        <div className="text-3xl">🔒</div>
        <h2 className="mt-2 font-bold text-slate-900">Parents only</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter the parent PIN to leave kid mode.
        </p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          required
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-widest focus:border-indigo-500 focus:outline-none"
          aria-label="Parent PIN"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-slate-100 py-2.5 font-semibold text-slate-700"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-lg bg-indigo-600 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : "Unlock"}
          </button>
        </div>
      </form>
    </div>
  );
}
