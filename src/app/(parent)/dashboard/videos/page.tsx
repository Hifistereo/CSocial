import { VideosManager } from "./videos-manager";

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const initial = ["PENDING", "APPROVED", "REJECTED", "REVOKED"].includes(
    status ?? ""
  )
    ? (status as "PENDING" | "APPROVED" | "REJECTED" | "REVOKED")
    : "PENDING";
  return <VideosManager initialStatus={initial} />;
}
