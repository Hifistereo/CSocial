import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { extractVideoId, fetchVideoMetadata } from "@/lib/youtube";
import {
  STATUS_TRANSITIONS,
  type AgeBand,
  type Category,
  type ContentStatus,
} from "@/lib/enums";

// The ONLY writers of ContentItem rows. Every mutation validates ownership,
// validates the state machine, and writes its AuditLog row atomically.

export async function addVideo(
  userId: string,
  input: {
    url: string;
    category: Category;
    ageBand: AgeBand;
    language?: string;
  }
) {
  const videoId = extractVideoId(input.url);
  if (!videoId) {
    throw new HttpError(400, "That doesn't look like a YouTube link");
  }

  const existing = await prisma.contentItem.findUnique({
    where: { familyId_videoId: { familyId: userId, videoId } },
  });
  if (existing) {
    throw new HttpError(409, "This video is already in your library");
  }

  const meta = await fetchVideoMetadata(videoId);

  return prisma.$transaction(async (tx) => {
    const item = await tx.contentItem.create({
      data: {
        familyId: userId,
        videoId,
        title: meta.title,
        channelName: meta.channelName,
        thumbnailUrl: meta.thumbnailUrl,
        durationSec: meta.durationSec,
        category: input.category,
        ageBand: input.ageBand,
        language: input.language ?? "en",
        status: "PENDING",
      },
    });
    await audit(tx, {
      familyId: userId,
      actorType: "PARENT",
      actorId: userId,
      action: "VIDEO_ADDED",
      entityType: "ContentItem",
      entityId: item.id,
      meta: { videoId, title: meta.title },
    });
    return item;
  });
}

const STATUS_ACTION = {
  APPROVED: "VIDEO_APPROVED",
  REJECTED: "VIDEO_REJECTED",
  REVOKED: "VIDEO_REVOKED",
} as const;

/** The sole function that mutates ContentItem.status. */
export async function setContentStatus(
  userId: string,
  itemId: string,
  newStatus: keyof typeof STATUS_ACTION
) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.contentItem.findUnique({ where: { id: itemId } });
    if (!item || item.familyId !== userId) {
      throw new HttpError(404, "Video not found");
    }
    const allowed = STATUS_TRANSITIONS[item.status as ContentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new HttpError(
        409,
        `Cannot change status from ${item.status} to ${newStatus}`
      );
    }
    const updated = await tx.contentItem.update({
      where: { id: item.id },
      data: { status: newStatus, statusChangedAt: new Date() },
    });
    await audit(tx, {
      familyId: userId,
      actorType: "PARENT",
      actorId: userId,
      action: STATUS_ACTION[newStatus],
      entityType: "ContentItem",
      entityId: item.id,
      meta: { from: item.status, to: newStatus, videoId: item.videoId },
    });
    return updated;
  });
}
