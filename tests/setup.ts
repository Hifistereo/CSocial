// Imported before every test file, before any app module: pin env so the
// Prisma singleton and auth code use the test database and a test secret.
process.env.DATABASE_URL = "file:./prisma/test-run.db";
process.env.SESSION_SECRET = "test-secret-do-not-use-in-production-0000";
