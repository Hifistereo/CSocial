import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPageSession } from "@/lib/session-server";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const session = await getPageSession();
  if (!session || session.scope === "child") redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, pinHash: true, watchRetentionDays: true },
  });
  if (!user) redirect("/login");

  return (
    <SettingsView
      email={user.email}
      hasPin={Boolean(user.pinHash)}
      watchRetentionDays={user.watchRetentionDays}
    />
  );
}
