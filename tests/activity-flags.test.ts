import { describe, it, expect, beforeEach } from "vitest";
import {
  resetDb,
  createFamily,
  createChild,
  createContentItem,
  callRoute,
  unlockedParentCookie,
} from "./helpers";
import { prisma } from "@/lib/db";

describe("parent activity & flags", () => {
  beforeEach(resetDb);

  it("activity is scoped to the family and filterable by child", async () => {
    const familyA = await createFamily("act1@test.family");
    const familyB = await createFamily("act2@test.family");
    const childA1 = await createChild(familyA.id, { nickname: "A1" });
    const childA2 = await createChild(familyA.id, { nickname: "A2" });
    const childB = await createChild(familyB.id, { nickname: "B1" });
    const itemA = await createContentItem(familyA.id, { title: "Video A" });
    const itemB = await createContentItem(familyB.id, { title: "Video B" });

    await prisma.watchEvent.createMany({
      data: [
        { childId: childA1.id, contentItemId: itemA.id, secondsWatched: 10 },
        { childId: childA2.id, contentItemId: itemA.id, secondsWatched: 20 },
        { childId: childB.id, contentItemId: itemB.id, secondsWatched: 30 },
      ],
    });

    const { GET } = await import("@/app/api/parent/activity/route");
    const cookie = await unlockedParentCookie(familyA.id);

    let raw = await (
      await callRoute(GET, "/api/parent/activity", { cookie })
    ).text();
    expect(raw).toContain("A1");
    expect(raw).toContain("A2");
    expect(raw).not.toContain("B1");
    expect(raw).not.toContain("Video B");

    raw = await (
      await callRoute(GET, `/api/parent/activity?childId=${childA1.id}`, {
        cookie,
      })
    ).text();
    expect(raw).toContain("A1");
    expect(raw).not.toContain("A2");

    // Smuggling another family's childId yields nothing, not a leak.
    raw = await (
      await callRoute(GET, `/api/parent/activity?childId=${childB.id}`, {
        cookie,
      })
    ).text();
    expect(raw).not.toContain("B1");
  });

  it("flags list is family-scoped and resolve writes an audit row", async () => {
    const familyA = await createFamily("flag1@test.family");
    const familyB = await createFamily("flag2@test.family");
    const childA = await createChild(familyA.id, { nickname: "Mine" });
    const childB = await createChild(familyB.id, { nickname: "Theirs" });
    const itemA = await createContentItem(familyA.id);
    const itemB = await createContentItem(familyB.id);

    const flagA = await prisma.childFlag.create({
      data: { childId: childA.id, contentItemId: itemA.id, type: "REPORT" },
    });
    const flagB = await prisma.childFlag.create({
      data: { childId: childB.id, contentItemId: itemB.id, type: "REPORT" },
    });

    const cookie = await unlockedParentCookie(familyA.id);
    const { GET } = await import("@/app/api/parent/flags/route");
    const raw = await (
      await callRoute(GET, "/api/parent/flags", { cookie })
    ).text();
    expect(raw).toContain("Mine");
    expect(raw).not.toContain("Theirs");

    const { POST } = await import(
      "@/app/api/parent/flags/[id]/resolve/route"
    );

    // Cannot resolve another family's flag.
    const cross = await callRoute(POST, `/api/parent/flags/${flagB.id}/resolve`, {
      cookie,
      body: {},
      params: { id: flagB.id },
    });
    expect(cross.status).toBe(404);

    const ok = await callRoute(POST, `/api/parent/flags/${flagA.id}/resolve`, {
      cookie,
      body: {},
      params: { id: flagA.id },
    });
    expect(ok.status).toBe(200);

    const resolved = await prisma.childFlag.findUnique({
      where: { id: flagA.id },
    });
    expect(resolved!.resolved).toBe(true);

    const logs = await prisma.auditLog.findMany({
      where: { familyId: familyA.id, action: "FLAG_RESOLVED" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].entityId).toBe(flagA.id);
  });
});
