import { prisma } from "@/lib/db";
import { bandsUpTo, type AgeBand, type Category } from "@/lib/enums";

// The ONLY query path that serves content to child scope. status:"APPROVED"
// and the family binding are hard-coded here — never parameterized.

export type FeedItem = {
  id: string;
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  category: string;
  durationSec: number | null;
  isFavorite: boolean;
};

const RECENT_HOURS = 48;
const CHANNEL_CAP_WINDOW = 5;
const CHANNEL_CAP = 2;

export async function buildFeed(
  childId: string,
  limit = 15
): Promise<FeedItem[]> {
  const child = await prisma.childProfile.findUniqueOrThrow({
    where: { id: childId },
  });
  const allowedCategories = JSON.parse(child.allowedCategories) as Category[];

  const pool = await prisma.contentItem.findMany({
    where: {
      familyId: child.familyId, // bound to the child's own family
      status: "APPROVED", // hard-coded: nothing else can ever be served
      ageBand: { in: bandsUpTo(child.ageBand as AgeBand) },
      category: { in: allowedCategories },
    },
  });

  const since = new Date(Date.now() - RECENT_HOURS * 3600_000);
  const recentEvents = await prisma.watchEvent.findMany({
    where: { childId, watchedAt: { gte: since } },
    select: { contentItemId: true, watchedAt: true },
    orderBy: { watchedAt: "asc" },
  });
  const recentIds = new Set(recentEvents.map((e) => e.contentItemId));

  const candidates = pool.filter((item) => !recentIds.has(item.id));
  if (candidates.length < limit) {
    // Small pilot catalogs run out quickly; repeating the oldest-watched
    // videos beats an empty feed.
    const rewatchOrder = recentEvents.map((e) => e.contentItemId);
    const seen = new Set(candidates.map((c) => c.id));
    for (const id of rewatchOrder) {
      if (candidates.length >= limit) break;
      if (seen.has(id)) continue;
      const item = pool.find((p) => p.id === id);
      if (item) {
        candidates.push(item);
        seen.add(id);
      }
    }
  }

  // Shuffle within each category, then round-robin across categories so no
  // single topic dominates. Deliberately no engagement-based ranking.
  const byCategory = new Map<string, typeof candidates>();
  for (const item of candidates) {
    const group = byCategory.get(item.category) ?? [];
    group.push(item);
    byCategory.set(item.category, group);
  }
  for (const group of byCategory.values()) shuffle(group);

  const interleaved: typeof candidates = [];
  const groups = [...byCategory.values()];
  let added = true;
  while (added && interleaved.length < candidates.length) {
    added = false;
    for (const group of groups) {
      const next = takeWithinChannelCap(group, interleaved);
      if (next) {
        interleaved.push(next);
        added = true;
      }
    }
  }

  const favorites = await prisma.favorite.findMany({
    where: { childId },
    select: { contentItemId: true },
  });
  const favoriteIds = new Set(favorites.map((f) => f.contentItemId));

  return interleaved.slice(0, limit).map((item) => ({
    id: item.id,
    videoId: item.videoId,
    title: item.title,
    channelName: item.channelName,
    thumbnailUrl: item.thumbnailUrl,
    category: item.category,
    durationSec: item.durationSec,
    isFavorite: favoriteIds.has(item.id),
  }));
}

/**
 * Pop the group's next item unless its channel already appeared CHANNEL_CAP
 * times in the last CHANNEL_CAP_WINDOW emitted items; in that case try later
 * items in the group and rotate the capped one to the back.
 */
function takeWithinChannelCap<T extends { channelName: string }>(
  group: T[],
  emitted: T[]
): T | null {
  if (group.length === 0) return null;
  const window = emitted.slice(-CHANNEL_CAP_WINDOW);
  for (let i = 0; i < group.length; i++) {
    const candidate = group[i];
    const channelCount = window.filter(
      (e) => e.channelName === candidate.channelName
    ).length;
    if (channelCount < CHANNEL_CAP) {
      group.splice(i, 1);
      return candidate;
    }
  }
  // Every remaining item in this group is channel-capped; emit anyway rather
  // than starving the feed.
  return group.shift() ?? null;
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
