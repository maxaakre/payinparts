# Delbetala — project notes for AI agents

Demo pay-later checkout for a Resurs technical interview. **No real money, no real personal data.**

## Layout
- `packages/core` — pure TS: money, plans, credit rules, products, API contract. No AWS imports.
- `services/api` — Lambda handlers. One handler file per Lambda.
- `infra` — AWS CDK app (region eu-north-1).
- `apps/web` — React + Vite frontend.
- `e2e` — Playwright tests against the deployed URL.

## Rules
- Money is integer öre. Use `kr()` to convert. Never store floats.
- The AI explains numbers from `packages/core`; it never calculates.
- No AWS access keys, ever. Local: `aws sso login`. CI: OIDC.
- Each Lambda gets only the IAM actions it needs. `infra/test` checks this.
- API errors: `{ error: { code, message } }`.
- TDD: write the failing test first.

## Commands
- `pnpm test` — all unit tests
- `pnpm typecheck` / `pnpm lint`
- `pnpm --filter @delbetala/web dev` — frontend (set `VITE_API_PROXY` to the deployed URL)
