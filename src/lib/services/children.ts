import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";
import type { AgeBand, Category } from "@/lib/enums";

// The ONLY writers of ChildProfile rows; every mutation is audit-logged
// in the same transaction.

export type ChildInput = {
  nickname: string;
  ageBand: AgeBand;
  allowedCategories: Category[];
  avatarColor?: string;
};

export async function createChild(userId: string, input: ChildInput) {
  return prisma.$transaction(async (tx) => {
    const child = await tx.childProfile.create({
      data: {
        familyId: userId,
        nickname: input.nickname,
        ageBand: input.ageBand,
        allowedCategories: JSON.stringify(input.allowedCategories),
        avatarColor: input.avatarColor ?? "blue",
      },
    });
    await audit(tx, {
      familyId: userId,
      actorType: "PARENT",
      actorId: userId,
      action: "CHILD_CREATED",
      entityType: "ChildProfile",
      entityId: child.id,
      meta: { nickname: input.nickname, ageBand: input.ageBand },
    });
    return child;
  });
}

export async function updateChild(
  userId: string,
  childId: string,
  input: Partial<ChildInput>
) {
  return prisma.$transaction(async (tx) => {
    const child = await tx.childProfile.findUnique({ where: { id: childId } });
    if (!child || child.familyId !== userId) {
      throw new HttpError(404, "Child profile not found");
    }
    const updated = await tx.childProfile.update({
      where: { id: child.id },
      data: {
        nickname: input.nickname,
        ageBand: input.ageBand,
        allowedCategories: input.allowedCategories
          ? JSON.stringify(input.allowedCategories)
          : undefined,
        avatarColor: input.avatarColor,
      },
    });
    await audit(tx, {
      familyId: userId,
      actorType: "PARENT",
      actorId: userId,
      action: "CHILD_UPDATED",
      entityType: "ChildProfile",
      entityId: child.id,
      meta: { changed: Object.keys(input) },
    });
    return updated;
  });
}

export async function deleteChild(userId: string, childId: string) {
  return prisma.$transaction(async (tx) => {
    const child = await tx.childProfile.findUnique({ where: { id: childId } });
    if (!child || child.familyId !== userId) {
      throw new HttpError(404, "Child profile not found");
    }
    await tx.childProfile.delete({ where: { id: child.id } });
    await audit(tx, {
      familyId: userId,
      actorType: "PARENT",
      actorId: userId,
      action: "CHILD_DELETED",
      entityType: "ChildProfile",
      entityId: child.id,
      meta: { nickname: child.nickname },
    });
  });
}
