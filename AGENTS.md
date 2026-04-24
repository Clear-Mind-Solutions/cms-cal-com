# AGENTS.md — cms-cal-com

## Agent Guidelines for cms-cal-com

### Credential Access
- **Never search for credentials** — always receive from caller or fetch from Infisical
- Infisical project: `cms-infra`, env: `prod`, Machine Identity: Clayde
- clientId: `f790c672-c979-4dbe-8df1-9e1a6d581c81` (Universal Auth)
- Secret names prefix: `CALCOM_*`

### Deployment Workflow
1. **File changes:** Use GitHub API (no repo clone — 2GB+), `PUT /contents/<path>`
2. **Commit message:** include `Co-Authored-By: Clayde <Model> <agent@clearmind-solutions.de>`
3. **Trigger:** Vercel auto-deploys on push to `main`
4. **Verify:** Check deployment state via Vercel MCP `list_deployments` until `READY`
5. **Test:** `curl -s -o /dev/null -w "%{http_code}" https://cal.clearmind-solutions.de/auth/login`

### Tool Call Limits
- **Max 15 tool calls** per agent run — stop and report at limit
- **1 credential error** = immediate abort, no retry, report back

### Vercel Constraints (Hobby Plan)
- Max function duration: 300s
- No cron jobs in vercel.json (use n8n instead)
- Custom domain: cal.clearmind-solutions.de

### Database
- Supabase PostgreSQL — migrations via `yarn prisma migrate deploy` (runs automatically in vercel-build)
- **Never run `prisma migrate reset`** in production
- Connection URL in Infisical: `CALCOM_DATABASE_URL`

### n8n Integration
- Base URL: https://n8n.clearmind-solutions.de
- API key in Infisical: `cms-n8n` project, `N8N_API_KEY`
- Workflow naming: `cal-*` prefix for cal.com-related workflows
