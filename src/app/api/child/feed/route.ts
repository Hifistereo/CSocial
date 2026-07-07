import { api } from "@/lib/api";
import { requireChild } from "@/lib/authz";
import { buildFeed } from "@/lib/feed";

// Identity comes exclusively from the child token; no params are read.
export const GET = api(async (req) => {
  const session = await requireChild(req);
  const items = await buildFeed(session.childId);
  return Response.json({ items });
});
