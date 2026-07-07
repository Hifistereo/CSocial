import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, HttpError } from "@/lib/api";
import { requireChild } from "@/lib/authz";

export const GET = api(async (req) => {
  const session = await requireChild(req);
  const favorites = await prisma.favorite.findMany({
    where: {
      childId: session.childId,
      // Only approved content is ever surfaced back to the child.
      contentItem: { status: "APPROVED", familyId: session.familyId },
    },
    include: { contentItem: true },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({
    items: favorites.map((f) => ({
      id: f.contentItem.id,
      videoId: f.contentItem.videoId,
      title: f.contentItem.title,
      channelName: f.contentItem.channelName,
      thumbnailUrl: f.contentItem.thumbnailUrl,
      category: f.contentItem.category,
      durationSec: f.contentItem.durationSec,
      isFavorite: true,
    })),
  });
});

const bodySchema = z
  .object({
    contentItemId: z.string().min(1),
    favorite: z.boolean(),
  })
  .strip();

export const POST = api(async (req) => {
  const session = await requireChild(req);
  const body = bodySchema.parse(await req.json());

  const item = await prisma.contentItem.findUnique({
    where: { id: body.contentItemId },
    select: { familyId: true },
  });
  if (!item || item.familyId !== session.familyId) {
    throw new HttpError(404, "Unknown video");
  }

  if (body.favorite) {
    await prisma.favorite.upsert({
      where: {
        childId_contentItemId: {
          childId: session.childId,
          contentItemId: body.contentItemId,
        },
      },
      create: { childId: session.childId, contentItemId: body.contentItemId },
      update: {},
    });
  } else {
    await prisma.favorite.deleteMany({
      where: { childId: session.childId, contentItemId: body.contentItemId },
    });
  }
  return Response.json({ ok: true });
});
