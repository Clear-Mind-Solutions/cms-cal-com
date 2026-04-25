import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { bookingIdempotencyKeyExtension } from "./extensions/booking-idempotency-key";
import { disallowUndefinedDeleteUpdateManyExtension } from "./extensions/disallow-undefined-delete-update-many";
import { excludeLockedUsersExtension } from "./extensions/exclude-locked-users";
import { excludePendingPaymentsExtension } from "./extensions/exclude-pending-payment-teams";
import { PrismaClient, type Prisma } from "./generated/prisma/client";

// Fall back to CALCOM_DATABASE_URL if DATABASE_URL is not set directly in the environment.
// Infisical stores the secret as CALCOM_DATABASE_URL; Vercel may expose it under either name.
const connectionString = process.env.DATABASE_URL || process.env.CALCOM_DATABASE_URL || "";

// Supabase (and most managed Postgres providers) require SSL for external connections.
// pg does not enable SSL by default; passing rejectUnauthorized: false accepts the managed
// TLS cert without requiring the CA bundle to be present in the serverless bundle.
// Set DATABASE_SSL=false explicitly to disable (e.g. local docker-compose Postgres).
const sslConfig: false | { rejectUnauthorized: boolean } =
  process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false };

/**
 * Build a pg.Pool config from the connection string.
 *
 * pg-connection-string@2.9.1 silently swallows URL-parse errors and leaves
 * `result` as undefined, causing a crash on `result.searchParams` (line 39).
 * This happens when the password contains unencoded '#' or '?' characters —
 * both terminate the URL path before the '@host' part, making both parse
 * attempts in pg-connection-string fail.
 *
 * Fix: if the WHATWG URL parser rejects the connection string, fall back to a
 * regex that reads the components directly (regex `.` matches '#' and '?'),
 * and pass them as individual Pool options so pg never calls the URL parser.
 */
function buildPoolConfig(connStr: string): ConstructorParameters<typeof Pool>[0] {
  if (!connStr) return {};
  try {
    // If Node's URL parser accepts the string, pg-connection-string will too.
    new URL(connStr);
    return { connectionString: connStr, ssl: sslConfig };
  } catch {
    // URL is malformed (e.g. unencoded '#' or '?' in the password).
    // Use a regex that doesn't stop at fragment/query markers so the raw
    // password (including '#' or '?') is captured correctly.
    // The greedy (.+) backtracks to the last '@' that is followed by a
    // valid host:port/database pattern, so passwords with '@' also work.
    const m = connStr.match(/^(?:postgresql|postgres):\/\/([^:@]+):(.+)@([^:/]+):(\d+)\/([^?#\s]+)/);
    if (m) {
      const [, user, password, host, portStr, database] = m;
      return { user, password, host, port: parseInt(portStr, 10), database, ssl: sslConfig };
    }
    // Last resort: pass as-is and let pg handle it.
    return { connectionString: connStr, ssl: sslConfig };
  }
}

const poolConfig = buildPoolConfig(connectionString);

const pool =
  process.env.USE_POOL === "true" || process.env.USE_POOL === "1"
    ? new Pool({ ...poolConfig, max: 5, idleTimeoutMillis: 300000 })
    : undefined;

// PrismaPg v6 requires a pg.Pool instance — passing a plain config object silently
// creates an adapter whose pool.connect() is undefined, crashing on first query.
// Always construct a Pool (single connection by default) and hand it to PrismaPg.
const pgPool = pool ?? new Pool(poolConfig);
const adapter = new PrismaPg(pgPool);
const prismaOptions: Prisma.PrismaClientOptions = {
  adapter,
};

const globalForPrisma = global as unknown as {
  baseClient: PrismaClient;
};
const loggerLevel = parseInt(process.env.NEXT_PUBLIC_LOGGER_LEVEL ?? "", 10);

if (!isNaN(loggerLevel)) {
  switch (loggerLevel) {
    case 5:
    case 6:
      prismaOptions.log = ["error"];
      break;
    case 4:
      prismaOptions.log = ["warn", "error"];
      break;
    case 3:
      prismaOptions.log = ["info", "error", "warn"];
      break;
    default:
      // For values 0, 1, 2 (or anything else below 3)
      prismaOptions.log = ["query", "info", "error", "warn"];
      break;
  }
}
const baseClient = globalForPrisma.baseClient || new PrismaClient(prismaOptions);

export const customPrisma = (options?: Prisma.PrismaClientOptions) => {
  let finalOptions = { ...prismaOptions };

  if (options?.datasources?.db?.url) {
    const customConnectionString = options.datasources.db.url;
    const customAdapter = new PrismaPg({ connectionString: customConnectionString });

    const { datasources: _datasources, ...restOptions } = options;
    finalOptions = {
      ...prismaOptions,
      ...restOptions,
      adapter: customAdapter,
    };
  } else if (options) {
    finalOptions = { ...prismaOptions, ...options };
  }

  return new PrismaClient(finalOptions)
    .$extends(excludeLockedUsersExtension())
    .$extends(excludePendingPaymentsExtension())
    .$extends(bookingIdempotencyKeyExtension())
    .$extends(disallowUndefinedDeleteUpdateManyExtension()) as unknown as PrismaClient;
};

// FIXME: Due to some reason, there are types failing in certain places due to the $extends. Fix it and then enable it
// Specifically we get errors like `Type 'string | Date | null | undefined' is not assignable to type 'Exact<string | Date | null | undefined, string | Date | null | undefined>'`

// Explanation why we cast as PrismaClient. When we leave Prisma to its devices it tries to infer logic based on the extensions, but this is not a simple extends.
// this makes the PrismaClient export type-hint impossible and it also is a massive hit on Prisma type hinting performance.
export const prisma: PrismaClient = baseClient
  .$extends(excludeLockedUsersExtension())
  .$extends(excludePendingPaymentsExtension())
  .$extends(bookingIdempotencyKeyExtension())
  .$extends(disallowUndefinedDeleteUpdateManyExtension()) as unknown as PrismaClient;

// This prisma instance is meant to be used only for READ operations.
// If self hosting, feel free to leave INSIGHTS_DATABASE_URL as empty and `readonlyPrisma` will default to `prisma`.
export const readonlyPrisma = process.env.INSIGHTS_DATABASE_URL
  ? customPrisma({
      datasources: { db: { url: process.env.INSIGHTS_DATABASE_URL } },
    })
  : prisma;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.baseClient = baseClient;
}

type OmitPrismaClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// we cant pass tx to functions as types miss match since we have a custom prisma client https://github.com/prisma/prisma/discussions/20924#discussioncomment-10077649
export type {
  OmitPrismaClient as PrismaTransaction,
  // we re-export the native PrismaClient type for backwards-compatibility.
  PrismaClient,
};

/**
 * @deprecated Use named export `prisma` instead
 */
export default prisma;
export * from "./selects";
