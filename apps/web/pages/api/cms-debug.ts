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

  const dbUrl = process.env.DATABASE_URL ?? "";
  let urlParseError: string | null = null;
  let urlPasswordAnalysis: Record<string, unknown> = {};
  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      const pwd = parsed.password ?? "";
      urlPasswordAnalysis = {
        ok: true,
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        passwordLength: pwd.length,
        passwordHasHash: pwd.includes("#"),
        passwordHasQuestion: pwd.includes("?"),
        passwordHasAt: pwd.includes("@"),
        passwordHasPercent: pwd.includes("%"),
        passwordHasSpace: pwd.includes(" "),
        // Show first 3 chars of decoded password (just to see type of char)
        passwordDecodedFirst3: decodeURIComponent(pwd).slice(0, 3),
      };
    } catch (e: unknown) {
      urlParseError = (e as Error).message;
      urlPasswordAnalysis = { ok: false, parseError: urlParseError };
    }
  }
  const info: Record<string, unknown> = {
    DATABASE_URL_set: !!dbUrl,
    DATABASE_URL_length: dbUrl.length,
    urlParsed: urlPasswordAnalysis,
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
