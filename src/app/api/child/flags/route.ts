import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, HttpError } from "@/lib/api";
import { requireChild } from "@/lib/authz";
import { FLAG_TYPES } from "@/lib/enums";

// The child's only write channel to the parent: enum-constrained, no free text.
const bodySchema = z
  .object({
    contentItemId: z.string().min(1),
    type: z.enum(FLAG_TYPES),
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

  // One open flag per (child, video, type) is enough signal for the parent.
  const existing = await prisma.childFlag.findFirst({
    where: {
      childId: session.childId,
      contentItemId: body.contentItemId,
      type: body.type,
      resolved: false,
    },
  });
  if (!existing) {
    await prisma.childFlag.create({
      data: {
        childId: session.childId,
        contentItemId: body.contentItemId,
        type: body.type,
      },
    });
  }
  return Response.json({ ok: true }, { status: 201 });
});
