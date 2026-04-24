# CLAUDE.md — cms-cal-com

## Project Context
Self-hosted [cal.com](https://cal.com) for Clear Mind Solutions, deployed via **Vercel** (Hobby plan).
- **Production URL:** https://cal.clearmind-solutions.de
- **GitHub Org:** Clear-Mind-Solutions/cms-cal-com
- **Framework:** Next.js monorepo (Turborepo), app root: `apps/web/`
- **Database:** Supabase PostgreSQL (credentials in Infisical `cms-infra/prod`, prefix `CALCOM_*`)

## Architecture
- Vercel builds from `rootDirectory = apps/web/`
- `vercel-build` script in `apps/web/package.json` runs `turbo run db-deploy` (Prisma migrations) before `next build`
- Hobby plan → no Vercel cron jobs → cron scheduling via **n8n** (7 workflows on n8n.clearmind-solutions.de)
- Attio CRM integration via n8n webhook `cal-attio-booking-sync` (booking events → Attio contacts)

## Commit Convention
Every Claude-authored commit:
```
Co-Authored-By: Clayde Sonnet 4.6 <agent@clearmind-solutions.de>
```
Substitute actual model name (Sonnet/Opus/Haiku + version).

## Key Paths
| Path | Purpose |
|------|---------|
| `apps/web/` | Next.js app (Vercel root) |
| `apps/web/vercel.json` | Function maxDuration settings (300s max, Hobby) |
| `apps/web/package.json` | `vercel-build` script (migration + build) |
| `packages/prisma/` | Prisma schema + migrations |

## No-Goes
- **No cron jobs in vercel.json** — Hobby plan blocks cron, use n8n instead
- **No maxDuration > 300** — Hobby plan hard limit
- **No direct DB writes bypassing Prisma** — schema managed via migrations only
- **No credentials committed** — all secrets in Infisical `cms-infra/prod`

## Secrets (Infisical)
Project: `cms-infra`, environment: `prod`, prefix: `CALCOM_*`
Machine Identity: Clayde (Universal Auth)
