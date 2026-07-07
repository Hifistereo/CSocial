import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { api } from "@/lib/api";
import { requireParentUnlocked } from "@/lib/authz";
import { audit } from "@/lib/audit";

const bodySchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});

export const POST = api(async (req) => {
  const session = await requireParentUnlocked(req);
  const body = bodySchema.parse(await req.json());

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.userId },
      data: { pinHash: await bcrypt.hash(body.pin, 10) },
    });
    await audit(tx, {
      familyId: session.userId,
      actorType: "PARENT",
      actorId: session.userId,
      action: "PIN_CHANGED",
      entityType: "User",
      entityId: session.userId,
    });
  });

  return Response.json({ ok: true });
});
