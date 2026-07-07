import { describe, it, expect, beforeEach } from "vitest";
import {
  resetDb,
  createFamily,
  createChild,
  createContentItem,
  callRoute,
  childCookie,
} from "./helpers";
import { GET as feedGET } from "@/app/api/child/feed/route";
import { prisma } from "@/lib/db";

// The critical product guarantee: a child can never see non-approved content
// or another family's content. Assertions run against the raw JSON string so
// leaks in nested fields are caught too.

describe("feed leak protection", () => {
  beforeEach(resetDb);

  it("returns only APPROVED items — never PENDING/REJECTED/REVOKED", async () => {
    const family = await createFamily("leak1@test.family");
    const child = await createChild(family.id, {
      ageBand: "AGE_10_12",
      allowedCategories: ["EDUCATION", "MUSIC", "ANIMALS"],
    });

    const approved = await createContentItem(family.id, {
      status: "APPROVED",
      videoId: "approvedVid",
    });
    await createContentItem(family.id, { status: "PENDING", videoId: "pendingVid" });
    await createContentItem(family.id, { status: "REJECTED", videoId: "rejectVid1" });
    await createContentItem(family.id, { status: "REVOKED", videoId: "revokedVid" });

    const res = await callRoute(feedGET, "/api/child/feed", {
      cookie: await childCookie(family.id, child.id),
    });
    expect(res.status).toBe(200);
    const raw = await res.text();

    expect(raw).toContain(approved.videoId);
    expect(raw).not.toContain("pendingVid");
    expect(raw).not.toContain("rejectVid1");
    expect(raw).not.toContain("revokedVid");
  });

  it("never returns another family's approved items", async () => {
    const familyA = await createFamily("leak2a@test.family");
    const familyB = await createFamily("leak2b@test.family");
    const childA = await createChild(familyA.id);

    await createContentItem(familyA.id, { videoId: "familyAvid1" });
    await createContentItem(familyB.id, { videoId: "familyBvid1" });

    const res = await callRoute(feedGET, "/api/child/feed", {
      cookie: await childCookie(familyA.id, childA.id),
    });
    const raw = await res.text();
    expect(raw).toContain("familyAvid1");
    expect(raw).not.toContain("familyBvid1");
  });

  it("filters by the child's age band (own and younger only)", async () => {
    const family = await createFamily("leak3@test.family");
    const child = await createChild(family.id, { ageBand: "AGE_7_9" });

    await createContentItem(family.id, { ageBand: "AGE_4_6", videoId: "bandY0unger" });
    await createContentItem(family.id, { ageBand: "AGE_7_9", videoId: "bandMatched" });
    await createContentItem(family.id, { ageBand: "AGE_10_12", videoId: "band0lder00" });

    const res = await callRoute(feedGET, "/api/child/feed", {
      cookie: await childCookie(family.id, child.id),
    });
    const raw = await res.text();
    expect(raw).toContain("bandY0unger");
    expect(raw).toContain("bandMatched");
    expect(raw).not.toContain("band0lder00");
  });

  it("filters by the child's allowed categories", async () => {
    const family = await createFamily("leak4@test.family");
    const child = await createChild(family.id, {
      allowedCategories: ["ANIMALS"],
    });

    await createContentItem(family.id, { category: "ANIMALS", videoId: "catAllowed0" });
    await createContentItem(family.id, { category: "GAMING", videoId: "catBl0cked0" });

    const res = await callRoute(feedGET, "/api/child/feed", {
      cookie: await childCookie(family.id, child.id),
    });
    const raw = await res.text();
    expect(raw).toContain("catAllowed0");
    expect(raw).not.toContain("catBl0cked0");
  });

  it("revoking an approved video removes it from the feed immediately", async () => {
    const family = await createFamily("leak5@test.family");
    const child = await createChild(family.id);
    const item = await createContentItem(family.id, { videoId: "toBeRevoked" });
    const cookie = await childCookie(family.id, child.id);

    let raw = await (
      await callRoute(feedGET, "/api/child/feed", { cookie })
    ).text();
    expect(raw).toContain("toBeRevoked");

    await prisma.contentItem.update({
      where: { id: item.id },
      data: { status: "REVOKED", statusChangedAt: new Date() },
    });

    raw = await (await callRoute(feedGET, "/api/child/feed", { cookie })).text();
    expect(raw).not.toContain("toBeRevoked");
  });
});
