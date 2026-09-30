# 2. Serverless + DynamoDB over containers + RDS

**Context:** Demo traffic is near zero most of the time, with bursts during the interview.

**Decision:** Lambda + API Gateway HTTP API + DynamoDB on-demand.

**Why:**
- Costs close to $0 when idle. No servers or patching.
- Scales automatically for bursts.
- The data is simple key lookups by order ID — a good DynamoDB fit.

**Trade-offs:**
- Cold starts (small, ~few hundred ms on Node 22 ARM).
- No ad-hoc SQL queries. For reporting in a real bank we would stream to an analytics store.
- Single-table design needs careful key planning (`PK=ORDER#id`, `SK=META|DECISION|AI#COUNT`).
