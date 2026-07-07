import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, jsonClearSession } from "@/lib/api";
import { requireParentUnlocked } from "@/lib/authz";

const updateSchema = z.object({
  watchRetentionDays: z.number().int().min(1).max(365),
});

export const PATCH = api(async (req) => {
  const session = await requireParentUnlocked(req);
  const body = updateSchema.parse(await req.json());
  await prisma.user.update({
    where: { id: session.userId },
    data: { watchRetentionDays: body.watchRetentionDays },
  });
  return Response.json({ ok: true });
});

/**
 * GDPR erasure: deleting the User cascades to children, content, watch
 * history, favorites, flags AND audit logs — nothing about the family
 * remains. The deletion itself is recorded in the server log only.
 */
export const DELETE = api(async (req) => {
  const session = await requireParentUnlocked(req);
  await prisma.user.delete({ where: { id: session.userId } });
  console.info(`account deleted: ${session.userId} at ${new Date().toISOString()}`);
  return jsonClearSession({ ok: true });
});
