import { api } from "@/lib/api";
import { requireParentUnlocked } from "@/lib/authz";
import { setContentStatus } from "@/lib/services/content";

export const POST = api(async (req, ctx) => {
  const session = await requireParentUnlocked(req);
  const { id } = await ctx.params;
  const item = await setContentStatus(session.userId, id, "REVOKED");
  return Response.json({ item });
});
