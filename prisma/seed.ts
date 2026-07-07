import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import type { Category, AgeBand, ContentStatus } from "../src/lib/enums";

// Demo/pilot fixture: 2 families, 4 children, a small curated catalog with
// mixed statuses so leak tests and dashboard demos are realistic.
// Passwords: parent@demo.family / password123 (PIN 1234)

type SeedVideo = {
  videoId: string;
  title: string;
  channelName: string;
  category: Category;
  ageBand: AgeBand;
  status: ContentStatus;
  language?: string;
};

const FAMILY_ONE_VIDEOS: SeedVideo[] = [
  // Education
  { videoId: "hq3yfQnllfQ", title: "Phonics Song with Two Words", channelName: "ChuChu TV", category: "EDUCATION", ageBand: "AGE_4_6", status: "APPROVED" },
  { videoId: "D0Ajq682yrA", title: "Counting 1 to 100", channelName: "Jack Hartmann", category: "EDUCATION", ageBand: "AGE_4_6", status: "APPROVED" },
  { videoId: "Vjcyq6dFFXc", title: "The Solar System Song", channelName: "KidsLearningTube", category: "SCIENCE", ageBand: "AGE_7_9", status: "APPROVED" },
  { videoId: "TWAgWcJMOFM", title: "How Do Airplanes Fly?", channelName: "SciShow Kids", category: "SCIENCE", ageBand: "AGE_7_9", status: "APPROVED" },
  { videoId: "8dJyRm2jJ-U", title: "Volcano Science Experiment", channelName: "SciShow Kids", category: "SCIENCE", ageBand: "AGE_10_12", status: "APPROVED" },
  // Animals
  { videoId: "aWXiuvHTvNo", title: "Sea Otters Hold Hands", channelName: "Nat Geo Kids", category: "ANIMALS", ageBand: "AGE_4_6", status: "APPROVED" },
  { videoId: "kM2H8fMDIVw", title: "Amazing Animal Facts: Octopus", channelName: "Nat Geo Kids", category: "ANIMALS", ageBand: "AGE_7_9", status: "APPROVED" },
  { videoId: "jTcRqcMh3iY", title: "Baby Elephants Compilation", channelName: "BBC Earth Kids", category: "ANIMALS", ageBand: "AGE_4_6", status: "APPROVED" },
  // Music
  { videoId: "XqZsoesa55w", title: "Baby Shark Dance", channelName: "Pinkfong", category: "MUSIC", ageBand: "AGE_4_6", status: "APPROVED" },
  { videoId: "0mYBSayCsH0", title: "If You're Happy and You Know It", channelName: "Super Simple Songs", category: "MUSIC", ageBand: "AGE_4_6", status: "APPROVED" },
  { videoId: "ZanHgPprl-0", title: "Kids Ukulele Lesson 1", channelName: "Music with Meg", category: "MUSIC", ageBand: "AGE_7_9", status: "APPROVED" },
  // Crafts
  { videoId: "1Yqk1sN1gCY", title: "Easy Origami Cat", channelName: "Easy Peasy Origami", category: "CRAFTS", ageBand: "AGE_7_9", status: "APPROVED" },
  { videoId: "5y8Xdp2rB8Y", title: "Paper Plate Crafts", channelName: "Craft Factory Kids", category: "CRAFTS", ageBand: "AGE_4_6", status: "APPROVED" },
  // Sports
  { videoId: "L_A_HjHZxfI", title: "Kids Workout - Fun Exercises", channelName: "Little Sports", category: "SPORTS", ageBand: "AGE_7_9", status: "APPROVED" },
  { videoId: "X655B4ISakg", title: "Yoga for Kids - Cosmic Kids", channelName: "Cosmic Kids Yoga", category: "SPORTS", ageBand: "AGE_4_6", status: "APPROVED" },
  // Stories
  { videoId: "hL4NZjm2LFA", title: "The Gruffalo Read Aloud", channelName: "Storytime Corner", category: "STORIES", ageBand: "AGE_4_6", status: "APPROVED" },
  { videoId: "0IiF11Ax4Qk", title: "Greek Myths for Kids: Icarus", channelName: "Story Explorers", category: "STORIES", ageBand: "AGE_10_12", status: "APPROVED" },
  // Non-approved items (must NEVER appear in any child feed)
  { videoId: "dQw4w9WgXcQ", title: "Pending Review Music Video", channelName: "Some Channel", category: "MUSIC", ageBand: "AGE_10_12", status: "PENDING" },
  { videoId: "9bZkp7q19f0", title: "Rejected Pop Video", channelName: "Some Channel", category: "MUSIC", ageBand: "AGE_10_12", status: "REJECTED" },
  { videoId: "kJQP7kiw5Fk", title: "Revoked Music Video", channelName: "Other Channel", category: "MUSIC", ageBand: "AGE_10_12", status: "REVOKED" },
];

const FAMILY_TWO_VIDEOS: SeedVideo[] = [
  { videoId: "6ZfuNTqbHE8", title: "Marvel-ous Science of Superheroes", channelName: "Science Max", category: "SCIENCE", ageBand: "AGE_10_12", status: "APPROVED" },
  { videoId: "FN37ZKvOfNU", title: "Minecraft Building Tips for Beginners", channelName: "Kid Gamer Guides", category: "GAMING", ageBand: "AGE_10_12", status: "APPROVED" },
  { videoId: "d-diB65scQU", title: "Sing Along: Do-Re-Mi", channelName: "Family Music Time", category: "MUSIC", ageBand: "AGE_7_9", status: "APPROVED" },
  { videoId: "tVlcKp3bWH8", title: "Wolves 101", channelName: "Nat Geo Kids", category: "ANIMALS", ageBand: "AGE_10_12", status: "APPROVED" },
  { videoId: "yCjJyiqpAuU", title: "Family Two Pending Video", channelName: "Some Channel", category: "OTHER", ageBand: "AGE_7_9", status: "PENDING" },
];

function thumb(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function seedFamily(opts: {
  email: string;
  children: { nickname: string; ageBand: AgeBand; allowedCategories: Category[]; avatarColor: string }[];
  videos: SeedVideo[];
}) {
  const passwordHash = await bcrypt.hash("password123", 10);
  const pinHash = await bcrypt.hash("1234", 10);

  const user = await prisma.user.create({
    data: { email: opts.email, passwordHash, pinHash },
  });

  const children = [];
  for (const c of opts.children) {
    children.push(
      await prisma.childProfile.create({
        data: {
          familyId: user.id,
          nickname: c.nickname,
          ageBand: c.ageBand,
          allowedCategories: JSON.stringify(c.allowedCategories),
          avatarColor: c.avatarColor,
        },
      })
    );
  }

  const items = [];
  for (const v of opts.videos) {
    items.push(
      await prisma.contentItem.create({
        data: {
          familyId: user.id,
          videoId: v.videoId,
          title: v.title,
          channelName: v.channelName,
          thumbnailUrl: thumb(v.videoId),
          category: v.category,
          ageBand: v.ageBand,
          language: v.language ?? "en",
          status: v.status,
        },
      })
    );
    await prisma.auditLog.create({
      data: {
        familyId: user.id,
        actorType: "PARENT",
        actorId: user.id,
        action: "VIDEO_ADDED",
        entityType: "ContentItem",
        entityId: items[items.length - 1].id,
        meta: JSON.stringify({ videoId: v.videoId, seeded: true }),
      },
    });
  }

  return { user, children, items };
}

async function main() {
  const familyOne = await seedFamily({
    email: "parent@demo.family",
    children: [
      { nickname: "Spark", ageBand: "AGE_4_6", allowedCategories: ["EDUCATION", "ANIMALS", "MUSIC", "STORIES", "SPORTS", "CRAFTS"], avatarColor: "orange" },
      { nickname: "Nova", ageBand: "AGE_10_12", allowedCategories: ["EDUCATION", "SCIENCE", "ANIMALS", "MUSIC", "SPORTS", "CRAFTS", "STORIES"], avatarColor: "teal" },
    ],
    videos: FAMILY_ONE_VIDEOS,
  });

  await seedFamily({
    email: "parent2@demo.family",
    children: [
      { nickname: "Pixel", ageBand: "AGE_10_12", allowedCategories: ["SCIENCE", "GAMING", "MUSIC", "ANIMALS"], avatarColor: "purple" },
      { nickname: "Bean", ageBand: "AGE_7_9", allowedCategories: ["MUSIC", "ANIMALS"], avatarColor: "green" },
    ],
    videos: FAMILY_TWO_VIDEOS,
  });

  // A little activity for family one so the dashboard isn't empty.
  const spark = familyOne.children[0];
  const approved = familyOne.items.filter((i) => i.status === "APPROVED");
  await prisma.watchEvent.create({
    data: { childId: spark.id, contentItemId: approved[0].id, secondsWatched: 95, completed: true },
  });
  await prisma.watchEvent.create({
    data: { childId: spark.id, contentItemId: approved[5].id, secondsWatched: 30, completed: false },
  });
  await prisma.favorite.create({
    data: { childId: spark.id, contentItemId: approved[0].id },
  });
  await prisma.childFlag.create({
    data: { childId: spark.id, contentItemId: approved[5].id, type: "MORE_LIKE_THIS" },
  });

  console.log("Seed complete:");
  console.log("  parent@demo.family / password123 (PIN 1234) — children: Spark (4–6), Nova (10–12)");
  console.log("  parent2@demo.family / password123 (PIN 1234) — children: Pixel (10–12), Bean (7–9)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
