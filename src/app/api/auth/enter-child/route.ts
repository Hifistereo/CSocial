import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, jsonWithSession, HttpError } from "@/lib/api";
import { childClaims } from "@/lib/auth";
import { requireParentBase } from "@/lib/authz";

const bodySchema = z.object({ childId: z.string().min(1) });

export const POST = api(async (req) => {
  const session = await requireParentBase(req);
  const body = bodySchema.parse(await req.json());

  // The child must belong to this parent's family.
  const child = await prisma.childProfile.findUnique({
    where: { id: body.childId },
  });
  if (!child || child.familyId !== session.userId) {
    throw new HttpError(403, "Forbidden");
  }

  return jsonWithSession(
    { childId: child.id, nickname: child.nickname },
    childClaims(session.userId, child.id, session.claims.tv)
  );
});
