import { z } from "zod";
import { prisma } from "@/lib/db";
import { api } from "@/lib/api";
import { requireParentUnlocked } from "@/lib/authz";
import { createChild } from "@/lib/services/children";
import { AGE_BANDS, AVATAR_COLORS, CATEGORIES } from "@/lib/enums";

export const GET = api(async (req) => {
  const session = await requireParentUnlocked(req);
  const children = await prisma.childProfile.findMany({
    where: { familyId: session.userId },
    orderBy: { createdAt: "asc" },
  });
  return Response.json({ children });
});

const createSchema = z.object({
  nickname: z.string().min(1).max(30),
  ageBand: z.enum(AGE_BANDS),
  allowedCategories: z.array(z.enum(CATEGORIES)).min(1),
  avatarColor: z.enum(AVATAR_COLORS).optional(),
});

export const POST = api(async (req) => {
  const session = await requireParentUnlocked(req);
  const body = createSchema.parse(await req.json());
  const child = await createChild(session.userId, body);
  return Response.json({ child }, { status: 201 });
});
