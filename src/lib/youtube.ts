import { HttpError } from "@/lib/api";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Extract the 11-char video id from any common YouTube URL form. */
export function extractVideoId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^(www|m)\./, "");
  let id: string | null = null;

  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0] || null;
  } else if (
    host === "youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "music.youtube.com"
  ) {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else {
      const match = url.pathname.match(
        /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/
      );
      if (match) id = match[1];
    }
  }

  return id && VIDEO_ID.test(id) ? id : null;
}

export type VideoMetadata = {
  title: string;
  channelName: string;
  thumbnailUrl: string;
  durationSec: number | null;
};

/**
 * Fetch metadata server-side. oEmbed needs no API key and covers title,
 * channel and thumbnail; duration is only available with a YouTube Data API
 * key (optional — everything works without it).
 */
export async function fetchVideoMetadata(
  videoId: string
): Promise<VideoMetadata> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

  const res = await fetch(oembedUrl);
  if (!res.ok) {
    throw new HttpError(
      404,
      "Video not found or not embeddable — check the link"
    );
  }
  const data = (await res.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };
  if (!data.title) {
    throw new HttpError(502, "Could not read video metadata");
  }

  return {
    title: data.title,
    channelName: data.author_name ?? "Unknown channel",
    thumbnailUrl:
      data.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    durationSec: await fetchDuration(videoId),
  };
}

async function fetchDuration(videoId: string): Promise<number | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${key}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: { contentDetails?: { duration?: string } }[];
    };
    const iso = data.items?.[0]?.contentDetails?.duration;
    return iso ? parseIsoDuration(iso) : null;
  } catch {
    return null;
  }
}

/** "PT1H2M3S" -> seconds. */
export function parseIsoDuration(iso: string): number | null {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}
