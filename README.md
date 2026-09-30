# PayInParts

A demo **pay-later checkout** with an **AI helper that explains the payment plan**.
Built on AWS serverless in TypeScript.

> ⚠️ Demo only. No real payments, no real personal data.

## What it shows

- Full-stack TypeScript: React frontend, Lambda backend, CDK infrastructure — one shared `core` package.
- AWS serverless: CloudFront, S3, API Gateway, Lambda, DynamoDB, Bedrock.
- IAM done right: **no access keys anywhere**. SSO locally, OIDC in CI, one least-privilege role per Lambda.
- Production basics: CI/CD, structured logs, X-Ray tracing, dashboard, alarms, smoke and e2e tests.
- AI with guardrails: Claude explains numbers; it never calculates them.

## Architecture

```
Browser ─► CloudFront ─┬─► S3 (React app)
                       └─► /api/* ─► API Gateway ─┬─► products
                                                   ├─► orders ──────┐
                                                   ├─► credit-check ├─► DynamoDB
                                                   └─► explain-plan ┘─► Bedrock (Claude)
```

## Repo layout

| Folder | What |
|---|---|
| `packages/core` | Money, payment plans, credit rules, products, API contract (pure TS) |
| `services/api` | Lambda handlers |
| `apps/web` | React + Vite frontend |
| `infra` | AWS CDK app |
| `e2e` | Playwright tests against the live site |
| `docs/decisions` | Why things are the way they are |

## Run locally

```bash
pnpm install
pnpm test            # unit + API + CDK tests
VITE_API_PROXY=https://<site>.cloudfront.net pnpm --filter @payinparts/web dev
```

## Deploy

Merging to `main` deploys via GitHub Actions (OIDC, no stored keys).
Manual deploy:

```bash
aws sso login --profile payinparts
pnpm --filter @payinparts/web build
pnpm --filter @payinparts/infra exec cdk deploy PayInParts -c alertEmail=<email> -c githubRepo=maxaakre/payinparts
```

First-time AWS account setup is in `docs/superpowers/plans/2026-09-30-delbetala.md`, Task 15.

## How it was built

Spec first, then a step-by-step plan, then small test-driven steps with an AI coding agent.
See `docs/superpowers/` and `CLAUDE.md`.
