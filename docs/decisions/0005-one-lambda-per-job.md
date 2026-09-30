# 5. One Lambda per job, not one "fat" Lambda

**Context:** We could run the whole API in one Lambda with a router.

**Decision:** Four Lambdas: products, orders, credit-check, explain-plan.

**Why:**
- Least privilege per function. Only explain-plan can call Bedrock; only orders can confirm.
- Separate timeouts (explain-plan: 20 s, others: 10 s) and separate alarms.
- A bug or load spike in the AI path does not affect checkout.

**Trade-offs:** More resources in CDK and slightly more cold starts. `orders` still handles three related routes, because splitting further gives no security benefit.
