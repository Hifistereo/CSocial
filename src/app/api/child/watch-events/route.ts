import { z } from "zod";
import { prisma } from "@/lib/db";
import { api, HttpError } from "@/lib/api";
import { requireChild } from "@/lib/authz";

// childId comes from the token only — any childId in the body is ignored by
// schema design (strict object, no such field).
const bodySchema = z
  .object({
    contentItemId: z.string().min(1),
    secondsWatched: z.number().int().min(0).max(24 * 3600),
    completed: z.boolean(),
  })
  .strip();

export const POST = api(async (req) => {
  const session = await requireChild(req);
  const body = bodySchema.parse(await req.json());

  // Only content from the child's own family can be reported on.
  const item = await prisma.contentItem.findUnique({
    where: { id: body.contentItemId },
    select: { familyId: true },
  });
  if (!item || item.familyId !== session.familyId) {
    throw new HttpError(404, "Unknown video");
  }

  const event = await prisma.watchEvent.create({
    data: {
      childId: session.childId,
      contentItemId: body.contentItemId,
      secondsWatched: body.secondsWatched,
      completed: body.completed,
    },
  });
  return Response.json({ id: event.id }, { status: 201 });
});
