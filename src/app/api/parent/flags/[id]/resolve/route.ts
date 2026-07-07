import { prisma } from "@/lib/db";
import { api, HttpError } from "@/lib/api";
import { requireParentUnlocked } from "@/lib/authz";
import { audit } from "@/lib/audit";

export const POST = api(async (req, ctx) => {
  const session = await requireParentUnlocked(req);
  const { id } = await ctx.params;

  const flag = await prisma.childFlag.findUnique({
    where: { id },
    include: { child: { select: { familyId: true } } },
  });
  if (!flag || flag.child.familyId !== session.userId) {
    throw new HttpError(404, "Flag not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.childFlag.update({
      where: { id: flag.id },
      data: { resolved: true },
    });
    await audit(tx, {
      familyId: session.userId,
      actorType: "PARENT",
      actorId: session.userId,
      action: "FLAG_RESOLVED",
      entityType: "ChildFlag",
      entityId: flag.id,
      meta: { type: flag.type, contentItemId: flag.contentItemId },
    });
  });

  return Response.json({ ok: true });
});
