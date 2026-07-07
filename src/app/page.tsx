import { redirect } from "next/navigation";
import { getPageSession } from "@/lib/session-server";

export default async function Home() {
  const session = await getPageSession();
  if (!session) redirect("/login");
  if (session.scope === "child") redirect("/feed");
  redirect("/profiles");
}
