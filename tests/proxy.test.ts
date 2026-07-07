import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import {
  mintSessionToken,
  childClaims,
  lockedParentClaims,
  unlockedParentClaims,
} from "@/lib/auth";

// Layer-1 (edge) enforcement matrix. These tests exercise proxy.ts directly,
// independent of the route handlers' own guards.

async function run(path: string, cookieToken?: string) {
  const req = new NextRequest(`http://localhost${path}`, {
    headers: cookieToken ? { cookie: `sid=${cookieToken}` } : {},
  });
  return proxy(req);
}

const tokens = {
  child: () => mintSessionToken(childClaims("family1", "child1", 0)),
  parentLocked: () => mintSessionToken(lockedParentClaims("family1", 0)),
  parentUnlocked: () => mintSessionToken(unlockedParentClaims("family1", 0)),
};

describe("proxy API zone enforcement", () => {
  it("child API: child token passes", async () => {
    const res = await run("/api/child/feed", await tokens.child());
    expect(res.status).toBe(200); // NextResponse.next()
  });

  it("child API: parent tokens are rejected", async () => {
    for (const t of [await tokens.parentLocked(), await tokens.parentUnlocked()]) {
      const res = await run("/api/child/feed", t);
      expect(res.status).toBe(401);
    }
  });

  it("child API: no token is rejected", async () => {
    const res = await run("/api/child/feed");
    expect(res.status).toBe(401);
  });

  it("parent API: unlocked parent passes", async () => {
    const res = await run("/api/parent/videos", await tokens.parentUnlocked());
    expect(res.status).toBe(200);
  });

  it("parent API: locked parent is rejected", async () => {
    const res = await run("/api/parent/videos", await tokens.parentLocked());
    expect(res.status).toBe(401);
  });

  it("parent API: child token is rejected", async () => {
    const res = await run("/api/parent/videos", await tokens.child());
    expect(res.status).toBe(401);
  });

  it("unknown API namespace is denied by default", async () => {
    const res = await run("/api/other/thing", await tokens.parentUnlocked());
    expect(res.status).toBe(404);
  });

  it("auth API is reachable without a token", async () => {
    const res = await run("/api/auth/login");
    expect(res.status).toBe(200);
  });
});

describe("proxy page routing", () => {
  it("dashboard redirects child scope to /feed", async () => {
    const res = await run("/dashboard", await tokens.child());
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location")).toContain("/feed");
  });

  it("dashboard redirects locked parent to /unlock", async () => {
    const res = await run("/dashboard/videos", await tokens.parentLocked());
    expect(res.headers.get("location")).toContain("/unlock");
  });

  it("dashboard redirects anonymous to /login", async () => {
    const res = await run("/dashboard");
    expect(res.headers.get("location")).toContain("/login");
  });

  it("feed redirects parent scope to /profiles", async () => {
    const res = await run("/feed", await tokens.parentUnlocked());
    expect(res.headers.get("location")).toContain("/profiles");
  });

  it("feed allows child scope", async () => {
    const res = await run("/feed", await tokens.child());
    expect(res.status).toBe(200);
  });

  it("profiles redirects child scope to /feed", async () => {
    const res = await run("/profiles", await tokens.child());
    expect(res.headers.get("location")).toContain("/feed");
  });

  it("login redirects an authenticated parent to /profiles", async () => {
    const res = await run("/login", await tokens.parentUnlocked());
    expect(res.headers.get("location")).toContain("/profiles");
  });
});
