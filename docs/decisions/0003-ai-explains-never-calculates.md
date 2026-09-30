# 3. The AI explains, it never calculates

**Context:** Language models can get numbers wrong. In consumer credit, a wrong price is a real problem (and in Sweden, total cost and effective rate must be shown correctly).

**Decision:** All money math lives in `packages/core` and is unit-tested. The Lambda puts the computed plan and all alternatives in the prompt as data. The model only explains and compares.

**Guardrails:**
- The client sends only a question; it cannot send its own numbers.
- The system prompt: use only given numbers, always mention total cost, never push more credit.
- Customer text is escaped so it cannot break out of its tag.
- Max 20 questions per order, 500 characters each, 400 output tokens; route throttling.
- If Bedrock fails, the plan table still works.

**Trade-offs:** The AI cannot answer "what if I pay 1 000 kr per month?" unless we compute that option. That is on purpose.
