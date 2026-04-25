import { Prisma } from "./client";

export async function isPrismaAvailableCheck(): Promise<boolean> {
  try {
    const { prisma } = await import("./index");

    await prisma.$queryRaw<unknown[]>(Prisma.sql`SELECT 1`);
    await prisma.$disconnect();
    return true;
  } catch {
    // Any error (PrismaClientInitializationError, URL parse error, network error, etc.)
    // means Prisma is not available in this context — skip migrations.
    return false;
  }
}
