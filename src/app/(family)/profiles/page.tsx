import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPageSession } from "@/lib/session-server";
import { AGE_BAND_LABELS, type AgeBand } from "@/lib/enums";
import { ProfileTile, ParentTile } from "./tiles";

export default async function ProfilesPage() {
  const session = await getPageSession();
  // proxy.ts guards this route; the check here is belt-and-braces.
  if (!session || session.scope === "child") redirect("/login");

  const children = await prisma.childProfile.findMany({
    where: { familyId: session.userId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-slate-900 p-6">
      <h1 className="text-2xl font-bold text-white">Who&apos;s watching?</h1>
      <div className="mt-10 flex flex-wrap items-start justify-center gap-6">
        {children.map((child) => (
          <ProfileTile
            key={child.id}
            childId={child.id}
            nickname={child.nickname}
            ageLabel={AGE_BAND_LABELS[child.ageBand as AgeBand] ?? ""}
            color={child.avatarColor}
          />
        ))}
        <ParentTile />
      </div>
      {children.length === 0 && (
        <p className="mt-8 max-w-xs text-center text-sm text-slate-400">
          No child profiles yet — open the parent area to create one.
        </p>
      )}
    </main>
  );
}
