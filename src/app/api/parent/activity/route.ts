import { prisma } from "@/lib/db";
import { api } from "@/lib/api";
import { requireParentUnlocked } from "@/lib/authz";

export const GET = api(async (req) => {
  const session = await requireParentUnlocked(req);
  const url = new URL(req.url);
  const childId = url.searchParams.get("childId") ?? undefined;

  const events = await prisma.watchEvent.findMany({
    where: {
      child: { familyId: session.userId }, // scope enforced via relation
      ...(childId ? { childId } : {}),
    },
    include: {
      child: { select: { id: true, nickname: true } },
      contentItem: {
        select: { title: true, channelName: true, thumbnailUrl: true, videoId: true },
      },
    },
    orderBy: { watchedAt: "desc" },
    take: 100,
  });

  return Response.json({
    events: events.map((e) => ({
      id: e.id,
      childId: e.child.id,
      childNickname: e.child.nickname,
      title: e.contentItem.title,
      channelName: e.contentItem.channelName,
      thumbnailUrl: e.contentItem.thumbnailUrl,
      watchedAt: e.watchedAt,
      secondsWatched: e.secondsWatched,
      completed: e.completed,
    })),
  });
});
