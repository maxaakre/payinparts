# 4. OIDC and IAM roles instead of access keys

**Context:** Long-lived access keys leak (laptops, logs, CI secrets) and are hard to rotate.

**Decision:** No long-lived keys anywhere.
- Laptop: IAM user with console access only (MFA, no access keys) + `aws login` (short-lived credentials). IAM Identity Center would be the enterprise choice, but it requires AWS Organizations, which ends the free plan.
- GitHub Actions: OIDC → `payinparts-github-deploy`, trusted only for this repo's `main` branch. PRs get a read-only diff role.
- CI roles may only assume the CDK bootstrap roles.
- Lambdas: one execution role each. Bedrock uses the role too, so there is no API key to store.

**Trade-offs:** A little more setup (IAM user + MFA, OIDC stack). Much smaller blast radius if something leaks.
