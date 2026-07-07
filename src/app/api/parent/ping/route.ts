import { api } from "@/lib/api";
import { requireParentUnlocked } from "@/lib/authz";

// Minimal parent-zone endpoint; used by the boundary test matrix and by the
// dashboard to detect an expired unlock.
export const GET = api(async (req) => {
  const session = await requireParentUnlocked(req);
  return Response.json({ ok: true, userId: session.userId });
});
