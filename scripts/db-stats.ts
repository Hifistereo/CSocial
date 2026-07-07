import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  console.log({
    users: await prisma.user.count(),
    children: await prisma.childProfile.count(),
    contentItems: await prisma.contentItem.count(),
    watchEvents: await prisma.watchEvent.count(),
    favorites: await prisma.favorite.count(),
    flags: await prisma.childFlag.count(),
    auditLogs: await prisma.auditLog.count(),
  });
}

main().finally(() => prisma.$disconnect());
