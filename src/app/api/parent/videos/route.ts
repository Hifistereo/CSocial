import { z } from "zod";
import { prisma } from "@/lib/db";
import { api } from "@/lib/api";
import { requireParentUnlocked } from "@/lib/authz";
import { addVideo } from "@/lib/services/content";
import { AGE_BANDS, CATEGORIES, CONTENT_STATUSES } from "@/lib/enums";

export const GET = api(async (req) => {
  const session = await requireParentUnlocked(req);
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = CONTENT_STATUSES.find((s) => s === statusParam);

  const items = await prisma.contentItem.findMany({
    where: { familyId: session.userId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ items });
});

const addSchema = z.object({
  url: z.string().min(1).max(2048),
  category: z.enum(CATEGORIES),
  ageBand: z.enum(AGE_BANDS),
  language: z.string().min(2).max(8).optional(),
});

export const POST = api(async (req) => {
  const session = await requireParentUnlocked(req);
  const body = addSchema.parse(await req.json());
  const item = await addVideo(session.userId, body);
  return Response.json({ item }, { status: 201 });
});
