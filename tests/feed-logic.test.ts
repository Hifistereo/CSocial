import { describe, it, expect, beforeEach } from "vitest";
import {
  resetDb,
  createFamily,
  createChild,
  createContentItem,
} from "./helpers";
import { prisma } from "@/lib/db";
import { buildFeed } from "@/lib/feed";

describe("buildFeed logic", () => {
  beforeEach(resetDb);

  it("excludes videos watched in the last 48h while fresh content remains", async () => {
    const family = await createFamily("fl1@test.family");
    const child = await createChild(family.id);
    const watched = await createContentItem(family.id, { videoId: "watchedVid1" });
    await createContentItem(family.id, { videoId: "freshVid0001" });
    await createContentItem(family.id, { videoId: "freshVid0002" });

    await prisma.watchEvent.create({
      data: { childId: child.id, contentItemId: watched.id, secondsWatched: 60 },
    });

    const feed = await buildFeed(child.id, 2);
    const videoIds = feed.map((i) => i.videoId);
    expect(videoIds).not.toContain("watchedVid1");
    expect(videoIds).toHaveLength(2);
  });

  it("does not exclude videos watched more than 48h ago", async () => {
    const family = await createFamily("fl2@test.family");
    const child = await createChild(family.id);
    const old = await createContentItem(family.id, { videoId: "oldWatched1" });

    await prisma.watchEvent.create({
      data: {
        childId: child.id,
        contentItemId: old.id,
        watchedAt: new Date(Date.now() - 72 * 3600_000),
      },
    });

    const feed = await buildFeed(child.id);
    expect(feed.map((i) => i.videoId)).toContain("oldWatched1");
  });

  it("refills with recently watched videos when the catalog runs dry", async () => {
    const family = await createFamily("fl3@test.family");
    const child = await createChild(family.id);
    const only = await createContentItem(family.id, { videoId: "theOnlyVid1" });

    await prisma.watchEvent.create({
      data: { childId: child.id, contentItemId: only.id },
    });

    // Everything has been watched recently, but the feed must not be empty.
    const feed = await buildFeed(child.id, 5);
    expect(feed.map((i) => i.videoId)).toContain("theOnlyVid1");
  });

  it("limits consecutive items from one channel when alternatives exist", async () => {
    const family = await createFamily("fl4@test.family");
    const child = await createChild(family.id, {
      allowedCategories: ["EDUCATION", "MUSIC"],
    });

    for (let i = 0; i < 6; i++) {
      await createContentItem(family.id, {
        channelName: "MegaChannel",
        category: "EDUCATION",
      });
    }
    for (let i = 0; i < 6; i++) {
      await createContentItem(family.id, {
        channelName: `Other${i}`,
        category: "MUSIC",
      });
    }

    const feed = await buildFeed(child.id, 12);
    // In every window of 5 consecutive items, MegaChannel appears at most
    // 2 times plus the forced-emission allowance; assert no 3-in-a-row.
    for (let i = 2; i < feed.length; i++) {
      const trio = [feed[i - 2], feed[i - 1], feed[i]];
      expect(
        trio.every((t) => t.channelName === "MegaChannel"),
        `3 consecutive MegaChannel items at ${i}`
      ).toBe(false);
    }
  });

  it("mixes categories instead of clustering them", async () => {
    const family = await createFamily("fl5@test.family");
    const child = await createChild(family.id, {
      allowedCategories: ["EDUCATION", "MUSIC", "ANIMALS"],
    });
    for (const category of ["EDUCATION", "MUSIC", "ANIMALS"] as const) {
      for (let i = 0; i < 3; i++) {
        await createContentItem(family.id, { category });
      }
    }

    const feed = await buildFeed(child.id, 9);
    // Round-robin interleave: the first three items must span 3 categories.
    const firstThree = new Set(feed.slice(0, 3).map((i) => i.category));
    expect(firstThree.size).toBe(3);
  });

  it("marks favorites in the feed payload", async () => {
    const family = await createFamily("fl6@test.family");
    const child = await createChild(family.id);
    const fav = await createContentItem(family.id, { videoId: "favVid00001" });
    await createContentItem(family.id, { videoId: "plainVid001" });
    await prisma.favorite.create({
      data: { childId: child.id, contentItemId: fav.id },
    });

    const feed = await buildFeed(child.id);
    const favItem = feed.find((i) => i.videoId === "favVid00001");
    const plain = feed.find((i) => i.videoId === "plainVid001");
    expect(favItem?.isFavorite).toBe(true);
    expect(plain?.isFavorite).toBe(false);
  });

  it("respects the limit", async () => {
    const family = await createFamily("fl7@test.family");
    const child = await createChild(family.id);
    for (let i = 0; i < 25; i++) await createContentItem(family.id);

    const feed = await buildFeed(child.id, 15);
    expect(feed.length).toBe(15);
  });
});

describe("child favorites and flags routes", () => {
  beforeEach(resetDb);

  it("favorite toggle round-trips and only surfaces approved favorites", async () => {
    const { callRoute, childCookie } = await import("./helpers");
    const family = await createFamily("ff1@test.family");
    const child = await createChild(family.id);
    const item = await createContentItem(family.id, { videoId: "favToggle01" });
    const cookie = await childCookie(family.id, child.id);

    const { POST, GET } = await import("@/app/api/child/favorites/route");
    const add = await callRoute(POST, "/api/child/favorites", {
      cookie,
      body: { contentItemId: item.id, favorite: true },
    });
    expect(add.status).toBe(200);

    let list = await (await callRoute(GET, "/api/child/favorites", { cookie })).text();
    expect(list).toContain("favToggle01");

    // Revoke the video -> it must vanish from favorites too.
    await prisma.contentItem.update({
      where: { id: item.id },
      data: { status: "REVOKED" },
    });
    list = await (await callRoute(GET, "/api/child/favorites", { cookie })).text();
    expect(list).not.toContain("favToggle01");
  });

  it("flags reject content from another family", async () => {
    const { callRoute, childCookie } = await import("./helpers");
    const familyA = await createFamily("ff2a@test.family");
    const familyB = await createFamily("ff2b@test.family");
    const childA = await createChild(familyA.id);
    const itemB = await createContentItem(familyB.id);

    const { POST } = await import("@/app/api/child/flags/route");
    const res = await callRoute(POST, "/api/child/flags", {
      cookie: await childCookie(familyA.id, childA.id),
      body: { contentItemId: itemB.id, type: "REPORT" },
    });
    expect(res.status).toBe(404);
  });

  it("duplicate open flags are collapsed", async () => {
    const { callRoute, childCookie } = await import("./helpers");
    const family = await createFamily("ff3@test.family");
    const child = await createChild(family.id);
    const item = await createContentItem(family.id);
    const cookie = await childCookie(family.id, child.id);

    const { POST } = await import("@/app/api/child/flags/route");
    for (let i = 0; i < 3; i++) {
      await callRoute(POST, "/api/child/flags", {
        cookie,
        body: { contentItemId: item.id, type: "MORE_LIKE_THIS" },
      });
    }
    const flags = await prisma.childFlag.findMany();
    expect(flags).toHaveLength(1);
  });
});
