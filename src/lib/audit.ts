import type { Prisma } from "@/generated/prisma/client";
import type { ActorType, AuditAction } from "@/lib/enums";

type Tx = Prisma.TransactionClient;

export type AuditEntry = {
  familyId: string;
  actorType: ActorType;
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  meta?: Record<string, unknown>;
};

/**
 * Write an audit row. Always called inside the same transaction as the state
 * change it records (see lib/services/*) so a mutation can never be committed
 * without its log entry.
 */
export async function audit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      familyId: entry.familyId,
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      meta: entry.meta ? JSON.stringify(entry.meta) : null,
    },
  });
}
