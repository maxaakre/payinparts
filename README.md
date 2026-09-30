# PayInParts

A demo **pay-later checkout** with an **AI helper that explains the payment plan**.
Built on AWS serverless in TypeScript.

> ⚠️ Demo only. No real payments, no real personal data.

## What it shows

- Full-stack TypeScript: React frontend, Lambda backend, CDK infrastructure — one shared `core` package.
- AWS serverless: CloudFront, S3, API Gateway, Lambda, DynamoDB, Bedrock.
- IAM done right: **no access keys anywhere**. `aws login` locally (short-lived console credentials), OIDC in CI, one least-privilege role per Lambda.
- Production basics: CI/CD, structured logs, X-Ray tracing (from Lambda), dashboard, alarms, smoke and e2e tests.
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
export AWS_PROFILE=payinparts
aws login --profile payinparts
pnpm --filter @payinparts/web build
pnpm --filter @payinparts/infra exec cdk deploy PayInParts -c alertEmail=<email> -c githubRepo=maxaakre/payinparts
```

### First-time setup

Use `<owner>/<repo>` for your GitHub repo (this repo: `maxaakre/payinparts`).

1. Secure the root user with MFA.
2. Create a **$10 budget** with email alerts (skip while on the AWS free plan — you can't be charged).
3. Create an IAM user in group `admins` (AdministratorAccess) with **console access only — no access keys**, turn on MFA, then run `aws login --profile payinparts` (AWS CLI ≥ 2.32).
   IAM Identity Center is the enterprise alternative, but enabling it creates an AWS Organization, which ends the free plan.
4. Enable **Bedrock access to Claude Haiku 4.5** in `eu-north-1` (submit Anthropic's one-time use case form). New accounts may wait up to 2 hours for account verification.
5. `export AWS_PROFILE=payinparts` and run `pnpm --filter @payinparts/infra exec cdk bootstrap aws://<account>/eu-north-1`.
6. Deploy the GitHub OIDC stack: `pnpm --filter @payinparts/infra exec cdk deploy PayInPartsGithubOidc -c alertEmail=<email> -c githubRepo=<owner>/<repo>`.
7. Set repo variables: `gh variable set AWS_ACCOUNT_ID --body <account>` and `gh variable set ALERT_EMAIL --body <email>`.
8. Confirm the SNS subscription email.

More detail: `docs/superpowers/plans/2026-09-30-delbetala.md`, Task 15.

## Observability notes

- **X-Ray:** the HTTP API has no X-Ray support. Traces start at the Lambda.
- **Alarms:** Lambda error alarms only catch timeouts, init failures and OOM, because `httpHandler` returns app errors as 500 responses. The **API 5xx alarm** is the main signal.
- **AI spend:** max 500 questions per UTC day, plus an alarm above 200 questions per hour.

## How it was built

Spec first, then a step-by-step plan, then small test-driven steps with an AI coding agent.
See `docs/superpowers/` and `CLAUDE.md`.
