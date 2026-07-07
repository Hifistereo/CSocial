import { prisma } from "@/lib/db";
import { api } from "@/lib/api";
import { requireParentUnlocked } from "@/lib/authz";

export const GET = api(async (req) => {
  const session = await requireParentUnlocked(req);

  const flags = await prisma.childFlag.findMany({
    where: { resolved: false, child: { familyId: session.userId } },
    include: {
      child: { select: { nickname: true } },
      contentItem: {
        select: {
          id: true,
          title: true,
          channelName: true,
          thumbnailUrl: true,
          category: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    flags: flags.map((f) => ({
      id: f.id,
      type: f.type,
      createdAt: f.createdAt,
      childNickname: f.child.nickname,
      video: f.contentItem,
    })),
  });
});
