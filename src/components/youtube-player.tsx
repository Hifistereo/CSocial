"use client";

import { useEffect, useRef, useState } from "react";

// Thin wrapper around the official YouTube IFrame API (loaded as a script
// tag, no npm dep), pointed at the privacy-enhanced nocookie host. The
// parent component overlays this iframe to block all click-through.

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

type YTNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      host?: string;
      videoId: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number; target: YTPlayer }) => void;
      };
    }
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export type PlayerHandle = {
  toggle: () => void;
  currentTime: () => number;
};

export function YouTubePlayer({
  videoId,
  onEnded,
  onPlayingChange,
  handleRef,
}: {
  videoId: string;
  onEnded: () => void;
  onPlayingChange: (playing: boolean) => void;
  handleRef: (handle: PlayerHandle | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let player: YTPlayer | null = null;
    let cancelled = false;
    const mountNode = document.createElement("div");
    containerRef.current?.appendChild(mountNode);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(mountNode, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            rel: 0,
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (!cancelled) e.target.playVideo();
            },
            onStateChange: (e) => {
              if (cancelled) return;
              if (e.data === YT.PlayerState.ENDED) {
                onPlayingChange(false);
                onEnded();
              } else {
                onPlayingChange(e.data === YT.PlayerState.PLAYING);
              }
            },
          },
        });
        handleRef({
          toggle: () => {
            if (!player || !window.YT) return;
            if (player.getPlayerState() === window.YT.PlayerState.PLAYING) {
              player.pauseVideo();
            } else {
              player.playVideo();
            }
          },
          currentTime: () => {
            try {
              return player?.getCurrentTime() ?? 0;
            } catch {
              return 0;
            }
          },
        });
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      handleRef(null);
      try {
        player?.destroy();
      } catch {
        /* iframe may already be gone */
      }
      mountNode.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-white/70">
        Could not load this video
      </div>
    );
  }
  return <div ref={containerRef} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />;
}
