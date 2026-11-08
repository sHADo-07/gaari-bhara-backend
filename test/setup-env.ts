import * as dotenv from "dotenv";
dotenv.config({ quiet: true });

/**
 * Tests ALWAYS run on a separate "<name>_test" database, because every test file
 * wipes it. Your real development database is never touched.
 */
const base = (process.env.DB_DATABASE || "gaari_bhara").replace(/_test$/, "");
process.env.DB_DATABASE = `${base}_test`;
process.env.NODE_ENV = "test";
process.env.JWT_BEARER_SECRET = process.env.JWT_BEARER_SECRET || "test-secret-at-least-16-chars";
process.env.JWT_TTL = "3600";
process.env.ALLOW_TEST_USER_HEADER = "true";
process.env.THROTTLE_DISABLED = "true";
