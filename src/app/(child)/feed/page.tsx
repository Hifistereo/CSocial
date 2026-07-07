import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPageSession } from "@/lib/session-server";
import { FeedClient } from "./feed-client";

export default async function FeedPage() {
  const session = await getPageSession();
  // proxy.ts guards this route; belt-and-braces here.
  if (!session || session.scope !== "child" || !session.childId) {
    redirect("/login");
  }
  const child = await prisma.childProfile.findUnique({
    where: { id: session.childId },
  });
  if (!child) redirect("/profiles");

  return <FeedClient nickname={child.nickname} />;
}
