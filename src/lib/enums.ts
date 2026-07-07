// Enum values for String columns in prisma/schema.prisma (SQLite has no
// native enums). Validate all external input against these with zod.

export const AGE_BANDS = ["AGE_4_6", "AGE_7_9", "AGE_10_12"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  AGE_4_6: "4–6",
  AGE_7_9: "7–9",
  AGE_10_12: "10–12",
};

/** Bands a child may see: their own band and everything younger. */
export function bandsUpTo(band: AgeBand): AgeBand[] {
  return AGE_BANDS.slice(0, AGE_BANDS.indexOf(band) + 1);
}

export const CATEGORIES = [
  "EDUCATION",
  "SCIENCE",
  "ANIMALS",
  "MUSIC",
  "CRAFTS",
  "SPORTS",
  "STORIES",
  "GAMING",
  "OTHER",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  EDUCATION: "Education",
  SCIENCE: "Science",
  ANIMALS: "Animals & Nature",
  MUSIC: "Music",
  CRAFTS: "Arts & Crafts",
  SPORTS: "Sports & Movement",
  STORIES: "Stories",
  GAMING: "Gaming",
  OTHER: "Other",
};

export const CONTENT_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "REVOKED",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Legal status transitions for ContentItem.status. */
export const STATUS_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["REVOKED"],
  REJECTED: ["APPROVED"], // parent may re-review a rejected video
  REVOKED: ["APPROVED"], // ...or re-approve a revoked one
};

export const FLAG_TYPES = ["MORE_LIKE_THIS", "REPORT"] as const;
export type FlagType = (typeof FLAG_TYPES)[number];

export const AVATAR_COLORS = [
  "blue",
  "green",
  "orange",
  "purple",
  "pink",
  "teal",
] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export type ActorType = "PARENT" | "CHILD" | "SYSTEM";

export const AUDIT_ACTIONS = [
  "VIDEO_ADDED",
  "VIDEO_APPROVED",
  "VIDEO_REJECTED",
  "VIDEO_REVOKED",
  "CHILD_CREATED",
  "CHILD_UPDATED",
  "CHILD_DELETED",
  "PIN_CHANGED",
  "FLAG_RESOLVED",
  "ACCOUNT_DELETED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
