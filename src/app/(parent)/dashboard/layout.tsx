import Link from "next/link";
import { LogoutButton } from "./nav-actions";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/videos", label: "Videos" },
  { href: "/dashboard/children", label: "Children" },
  { href: "/dashboard/activity", label: "Activity" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-lg font-bold text-slate-900">
            CSocial <span className="text-sm font-normal text-slate-400">parent</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/profiles"
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Profiles
            </Link>
            <LogoutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
