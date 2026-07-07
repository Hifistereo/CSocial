import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  mintSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
  type SessionClaims,
} from "@/lib/auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

type Handler = (
  req: Request,
  ctx: { params: Promise<Record<string, string>> }
) => Promise<Response>;

/**
 * Wraps a route handler so guards can `throw new HttpError(...)` and zod can
 * throw on bad input, both mapping to clean JSON errors.
 */
export function api(fn: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Invalid input", issues: err.issues },
          { status: 400 }
        );
      }
      console.error(err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

/** JSON response that also (re)sets the session cookie. */
export async function jsonWithSession(
  body: unknown,
  claims: SessionClaims,
  init?: ResponseInit
): Promise<NextResponse> {
  const res = NextResponse.json(body, init);
  res.cookies.set(SESSION_COOKIE, await mintSessionToken(claims), sessionCookieOptions);
  return res;
}

export function jsonClearSession(body: unknown): NextResponse {
  const res = NextResponse.json(body);
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
