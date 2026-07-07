import { z } from "zod";
import { api } from "@/lib/api";
import { requireParentUnlocked } from "@/lib/authz";
import { deleteChild, updateChild } from "@/lib/services/children";
import { AGE_BANDS, AVATAR_COLORS, CATEGORIES } from "@/lib/enums";

const updateSchema = z.object({
  nickname: z.string().min(1).max(30).optional(),
  ageBand: z.enum(AGE_BANDS).optional(),
  allowedCategories: z.array(z.enum(CATEGORIES)).min(1).optional(),
  avatarColor: z.enum(AVATAR_COLORS).optional(),
});

export const PATCH = api(async (req, ctx) => {
  const session = await requireParentUnlocked(req);
  const { id } = await ctx.params;
  const body = updateSchema.parse(await req.json());
  const child = await updateChild(session.userId, id, body);
  return Response.json({ child });
});

export const DELETE = api(async (req, ctx) => {
  const session = await requireParentUnlocked(req);
  const { id } = await ctx.params;
  await deleteChild(session.userId, id);
  return Response.json({ ok: true });
});
