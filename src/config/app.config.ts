import { z } from "zod";
import * as dotenv from "dotenv";
dotenv.config({ quiet: true });

/** "true"/"false" strings from .env -> real booleans (z.coerce.boolean() gets this wrong). */
const bool = (def: boolean) =>
  z.preprocess(
    (v) => (v === undefined || v === "" ? def : String(v).toLowerCase() === "true"),
    z.boolean(),
  );

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().default(5000),

    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.coerce.number().int().default(5432),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_DATABASE: z.string().min(1),

    JWT_BEARER_SECRET: z.string().min(16, "JWT_BEARER_SECRET must be at least 16 characters"),
    /** Access token lifetime in seconds (default 1 day). */
    JWT_TTL: z.coerce.number().int().positive().default(86400),

    /** Comma separated list of allowed browser origins. */
    CORS_ORIGINS: z.string().default("http://localhost:3000"),
    FRONTEND_URL: z.string().default("http://localhost:3000"),

    /**
     * DEV ONLY helper so teammates can build before login is ready:
     * send header  x-test-user-id: <user uuid>  instead of a token.
     * Ignored when NODE_ENV=production.
     */
    ALLOW_TEST_USER_HEADER: bool(false),
    THROTTLE_DISABLED: bool(false),

    // Optional for later (Socket.IO adapter, email). Not needed for the midterm.
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().int().default(6379),
    REDIS_PASSWORD: z.string().optional(),
  })
  .transform((e) => ({
    ...e,
    REDIS_URL: e.REDIS_PASSWORD
      ? `redis://:${e.REDIS_PASSWORD}@${e.REDIS_HOST}:${e.REDIS_PORT}`
      : `redis://${e.REDIS_HOST}:${e.REDIS_PORT}`,
  }));

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n${lines.join("\n")}\nCheck your .env file (see .env.example).`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production" && /change|secret|example/i.test(env.JWT_BEARER_SECRET)) {
    throw new Error("JWT_BEARER_SECRET looks like a placeholder. Use a long random value in production.");
  }
  return env;
}

export const appConfig = {
  default_schema_identifier: "public",
  env: loadEnv(),
};

/** Test-user header is only honoured outside production. */
export const isTestUserHeaderAllowed = () =>
  appConfig.env.ALLOW_TEST_USER_HEADER && appConfig.env.NODE_ENV !== "production";
