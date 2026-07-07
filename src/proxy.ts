import { NextResponse, type NextRequest } from "next/server";
import {
  isUnlocked,
  verifySessionToken,
  SESSION_COOKIE,
  type SessionClaims,
} from "@/lib/auth";

// Layer-1 enforcement of the parent/child boundary, keyed off path prefixes
// so every new route under a zone is protected the moment it is created.
// (Next.js 16: this file replaces middleware.ts and runs before every request.)
// DB-backed checks (tokenVersion) live in lib/authz.ts, layer 2.

async function readClaims(req: NextRequest): Promise<SessionClaims | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

function apiUnauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname;
  const claims = await readClaims(req);
  const redirect = (to: string) =>
    NextResponse.redirect(new URL(to, req.nextUrl.origin));

  // ---- API zones ----
  if (path.startsWith("/api/auth/")) return NextResponse.next();
  if (path.startsWith("/api/child/")) {
    return claims?.scope === "child" ? NextResponse.next() : apiUnauthorized();
  }
  if (path.startsWith("/api/parent/")) {
    return claims && claims.scope !== "child" && isUnlocked(claims)
      ? NextResponse.next()
      : apiUnauthorized();
  }
  // Deny-by-default: no other API namespace exists.
  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ---- Pages ----
  if (path.startsWith("/dashboard")) {
    if (!claims) return redirect("/login");
    if (claims.scope === "child") return redirect("/feed");
    if (!isUnlocked(claims)) return redirect("/unlock");
    return NextResponse.next();
  }
  if (path === "/feed" || path.startsWith("/feed/")) {
    if (claims?.scope === "child") return NextResponse.next();
    return redirect(claims ? "/profiles" : "/login");
  }
  if (path === "/profiles" || path === "/unlock") {
    if (!claims) return redirect("/login");
    if (claims.scope === "child") return redirect("/feed");
    return NextResponse.next();
  }
  if (path === "/login" || path === "/register") {
    if (claims?.scope === "child") return redirect("/feed");
    if (claims) return redirect("/profiles");
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Everything except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest).*)"],
};
