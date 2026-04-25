/**
 * Temporary diagnostic endpoint — REMOVE after DB issue is resolved.
 *
 * Usage: GET /api/cms-debug?token=cms2026
 * Returns JSON with DB connectivity status and error detail.
 */
import type { NextApiRequest, NextApiResponse } from "next";

import prisma from "@calcom/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.query.token !== "cms2026") {
    return res.status(404).json({ error: "not found" });
  }

  const info: Record<string, unknown> = {
    DATABASE_URL_set: !!process.env.DATABASE_URL,
    CALCOM_DATABASE_URL_set: !!process.env.CALCOM_DATABASE_URL,
    DATABASE_SSL: process.env.DATABASE_SSL ?? "(unset)",
    USE_POOL: process.env.USE_POOL ?? "(unset)",
    NODE_ENV: process.env.NODE_ENV,
  };

  try {
    const userCount = await prisma.user.count();
    return res.status(200).json({ ok: true, userCount, ...info });
  } catch (e: unknown) {
    const err = e as Error & { code?: string };
    return res.status(200).json({
      ok: false,
      error: err.message,
      code: err.code,
      name: err.name,
      stack: err.stack?.split("\n").slice(0, 12),
      ...info,
    });
  }
}
