# PayInParts — Design Spec

**Date:** 2026-09-30
**Author:** Max Aakre
**Status:** Draft — awaiting review

## 1. Purpose

A small, live, deployed demo app to bring to the **technical interview** for the
Software Engineer role at Resurs.

The app shows, end to end:

- **TypeScript** across frontend, backend and infrastructure
- **AWS serverless** (Lambda, API Gateway, S3, CloudFront, DynamoDB)
- **IAM done right** — roles and short-lived credentials only, no stored keys
- **Production ownership** — CI/CD, logs, tracing, dashboards, alarms
- **AI in the product** (Claude via Amazon Bedrock) and **AI in the workflow**
- **Product thinking** — a clear, honest customer journey in Resurs's domain

**Success criteria**

- A public URL that works during the interview.
- The whole flow (shop → checkout → credit check → plan → AI explain → confirm) works.
- No long-lived AWS access keys exist anywhere (laptop, repo, CI).
- Every major choice has a short written decision note.
- Fits in about **10–15 hours** of work.

## 2. Non-goals

- No real money. **No payment provider is integrated.** Nothing can charge a card.
- No real login or BankID.
- No real credit data or real personal numbers.
- No multi-region, no custom domain (CloudFront default domain is fine).

## 3. User flow

A **"Demo — no real payments"** banner is shown on every page.

1. **Shop** — 3–5 made-up products with name, image, price in SEK.
   Example: headphones 2 490 kr, bike 8 990 kr, sofa 14 990 kr.
2. **Checkout** — the customer picks a payment option:
   - **Pay now** (simulated, no charge)
   - **Pay in 30 days** (invoice)
   - **Split payment**: 3, 6 or 12 months
3. **Credit check** (only for invoice and split payment)
   - The customer picks a **test persona** from a list (for example
     "Anna, 38 000 kr/month"). There is **no free-text personal number field**,
     so real personal data cannot be entered.
   - The monthly income is editable (number field, 0–200 000 kr).
   - The backend returns **approved**, **approved with lower limit**, or **declined**.
4. **Payment plan** — a table with: monthly cost, interest, fees,
   **total cost** and **effective annual rate** (effektiv ränta).
5. **Explain this plan (AI)** — Claude explains the plan in plain Swedish or
   English (follows the UI language). The customer can ask follow-up questions,
   for example "what if I pick 6 months instead?".
6. **Confirmation** — the order is saved. An order page shows its details and status.

**Product rules**

- The total cost is always visible next to the monthly cost.
- The AI never encourages taking more credit and always mentions total cost.
- Declines use calm, clear language and suggest options (shorter plan, pay now).

## 4. Business rules (fake, but realistic)

All money is handled as **integer öre** to avoid float errors.

**Payment options**

| Option        | Interest (yearly) | Setup fee | Monthly/invoice fee |
|---------------|-------------------|-----------|---------------------|
| Pay now       | 0 %               | 0 kr      | 0 kr                |
| Pay in 30 days| 0 %               | 0 kr      | 29 kr (once)        |
| Split 3 months| 0 %               | 0 kr      | 29 kr               |
| Split 6 months| 9.95 %            | 195 kr    | 29 kr               |
| Split 12 months| 14.95 %          | 195 kr    | 29 kr               |

- Monthly cost uses the standard **annuity formula**.
- **Effective annual rate** is computed from the full cash flow (fees included).

**Credit check**

- Credit limit = `min(monthly income × 0.5, 50 000 kr)`.
- Monthly cost must be ≤ 10 % of monthly income.
- Result:
  - **approved** — amount ≤ limit and monthly cost rule passes.
  - **approved with lower limit** — amount > limit but a shorter plan or smaller
    amount would pass; the response says what would work.
  - **declined** — otherwise, or if the persona is flagged (one test persona
    always declines, to demo that path).
- Each decision is saved with its inputs and a rules version.

All payment math and credit rules are **plain, tested TypeScript**. The AI only
explains numbers the backend has already computed.

## 5. Architecture

```
Browser (React + Vite)
   │
   ▼
CloudFront ── S3 (static frontend, private bucket, Origin Access Control)
   │
   ▼  /api/*
API Gateway (HTTP API)
   │
   ├─► Lambda: products      → static product list
   ├─► Lambda: credit-check  → rules, saves decision
   ├─► Lambda: orders        → create / get order
   └─► Lambda: explain-plan  → Amazon Bedrock (Claude)
                │
                ▼
            DynamoDB (single table: orders + decisions)
```

- **Region:** `eu-north-1` (Stockholm). Bedrock is called via an **EU
  cross-region inference profile**. The model ID is config, not hard-coded.
  Default model: Claude Haiku 4.5 (fast and cheap).
- **API behind CloudFront** on the same domain → no CORS setup needed.
- **One Lambda per job** → small blast radius, least-privilege roles.
- **DynamoDB single table**, on-demand billing.
  - `PK=ORDER#<id>`, `SK=META` — order
  - `PK=ORDER#<id>`, `SK=DECISION` — credit decision
  - `PK=ORDER#<id>`, `SK=AI#COUNT` — AI question counter
- **Runtime:** Node.js (latest LTS on Lambda), bundled with esbuild via CDK.

## 6. Repository layout

pnpm workspace monorepo:

```
apps/web/          React + Vite frontend
services/api/      Lambda handlers
packages/core/     Payment math, credit rules, shared types, Zod schemas
infra/             AWS CDK app (TypeScript)
docs/decisions/    Short decision notes (ADRs)
.github/workflows/ CI/CD
```

- `packages/core` has **no AWS dependencies**. It is used by both frontend and
  backend, so the plan shown in the UI matches the backend exactly.
- Input is validated with **Zod** at the API edge and in the frontend forms.

## 7. AI helper (explain-plan)

- **Input:** order ID + the user's question (max 500 characters).
- The Lambda loads the saved plan from DynamoDB. The plan numbers are placed in
  the prompt as data. The client **cannot** send its own numbers.
- For "what if 6 months?" questions, the Lambda computes the other plans with
  `packages/core` and includes them. The AI compares; it does not calculate.
- **System prompt rules:** only talk about this plan and payments in general;
  always state the total cost; never encourage more credit; answer in the UI
  language; say clearly that this is a demo.
- **Limits:**
  - Max 20 questions per order (counter in DynamoDB).
  - API Gateway throttling on the route.
  - Max output tokens set low (about 400).
- **Failure:** if Bedrock fails or times out, the UI shows "The helper is not
  available right now" and the plan table still works.

## 8. Security and IAM

- **No long-lived AWS keys anywhere.**
  - Laptop: `aws sso login` via IAM Identity Center.
  - GitHub Actions: **OIDC** to an IAM deploy role. Trust policy is limited to
    this repo's `main` branch (and a read-only role for PR `cdk diff`).
  - Lambdas: one execution role each, least privilege:
    - `products`: logs only
    - `credit-check`: `PutItem` on the table
    - `orders`: `PutItem` / `GetItem` on the table
    - `explain-plan`: `GetItem` / `UpdateItem` on the table + `bedrock:InvokeModel`
      on the chosen model/inference profile only
- S3 bucket is private; only CloudFront can read it.
- No secrets are needed at all (Bedrock uses the IAM role).
- No real personal data can be entered (persona picker only).

**New account setup (one time, documented in README):**

1. MFA on the root user.
2. Budget alert (for example $10/month) to your email.
3. IAM Identity Center user with admin access; stop using root.
4. Enable Anthropic Claude model access in Bedrock (one-time use-case form).
5. `cdk bootstrap` in `eu-north-1`.
6. Create the GitHub OIDC provider and deploy roles (part of the CDK app).

## 9. CI/CD

GitHub Actions:

- **On pull request:** install, lint, type-check, unit + API tests, `cdk diff`
  posted as a PR comment.
- **On merge to `main`:** build, `cdk deploy`, then a **smoke test** against the
  live URL (products endpoint returns 200, page loads).

## 10. Observability

- **Structured JSON logs** with AWS Lambda Powertools (logger, tracer, metrics).
- **X-Ray tracing** across API Gateway → Lambda → DynamoDB / Bedrock.
- **Custom metrics:** credit decisions by result, AI questions, AI tokens used.
- **CloudWatch dashboard:** requests, errors, latency (p50/p95), AI usage.
- **Alarms:** Lambda error rate, API 5xx rate, and the AWS budget.

## 11. Error handling

- All API errors use one shape: `{ error: { code, message } }`.
- Zod validation errors → `400` with a clear message.
- Unknown order → `404`.
- AI limit reached → `429` with a friendly message.
- Unexpected errors → `500`, logged with request ID; no internal details leak.
- The frontend shows calm, human messages for each case.

## 12. Testing

- **Unit tests (Vitest)** in `packages/core`: annuity math, fees, effective
  rate, credit rules, edge cases (0 income, max amount, rounding).
- **API tests (Vitest)** for each handler, with DynamoDB and Bedrock mocked.
- **CDK assertion tests:** check IAM policies are least-privilege (for example,
  only `explain-plan` has `bedrock:InvokeModel`) and the bucket is private.
- **One end-to-end test (Playwright):** shop → checkout → plan → confirm,
  run against the deployed URL after deploy.

## 13. Decision notes (docs/decisions)

Short notes (context, decision, trade-offs):

1. CDK over SST / SAM
2. Serverless + DynamoDB over containers + RDS
3. The AI explains, it never calculates
4. OIDC and roles instead of access keys
5. One Lambda per route vs one "fat" Lambda

## 14. How it was built (interview talking point)

The project is built with an AI-assisted, spec-first workflow: this spec →
an implementation plan → small tested steps. A `CLAUDE.md` in the repo records
the conventions. This is a concrete example for the "agentic workflows" part of
the role.

## 15. Rough cost

Close to **$0/month** at demo traffic (free tier covers Lambda, API Gateway,
DynamoDB, CloudFront). Bedrock costs a few cents per AI question. The budget
alarm is the safety net.
