import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPageSession } from "@/lib/session-server";

export default async function DashboardOverview() {
  const session = await getPageSession();
  if (!session || session.scope === "child") redirect("/login");
  const familyId = session.userId;

  const [pendingCount, approvedCount, childCount, openFlags] =
    await Promise.all([
      prisma.contentItem.count({ where: { familyId, status: "PENDING" } }),
      prisma.contentItem.count({ where: { familyId, status: "APPROVED" } }),
      prisma.childProfile.count({ where: { familyId } }),
      prisma.childFlag.count({
        where: { resolved: false, child: { familyId } },
      }),
    ]);

  const cards = [
    {
      href: "/dashboard/videos?status=PENDING",
      label: "Videos waiting for review",
      value: pendingCount,
      accent: pendingCount > 0 ? "text-amber-600" : "text-slate-900",
    },
    {
      href: "/dashboard/videos?status=APPROVED",
      label: "Approved videos",
      value: approvedCount,
      accent: "text-slate-900",
    },
    {
      href: "/dashboard/children",
      label: "Child profiles",
      value: childCount,
      accent: "text-slate-900",
    },
    {
      href: "/dashboard/activity",
      label: "Requests from kids",
      value: openFlags,
      accent: openFlags > 0 ? "text-indigo-600" : "text-slate-900",
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">Overview</h1>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm"
          >
            <div className={`text-3xl font-bold ${card.accent}`}>
              {card.value}
            </div>
            <div className="mt-1 text-sm text-slate-500">{card.label}</div>
          </Link>
        ))}
      </div>
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">How it works</h2>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-600">
          <li>Paste a YouTube link on the Videos page.</li>
          <li>Review it, pick a category and age group, then approve.</li>
          <li>
            Your kids see approved videos only — filtered by their age group
            and the categories you allow.
          </li>
          <li>Changed your mind? Revoke — it disappears from their feed instantly.</li>
        </ol>
      </div>
    </div>
  );
}
