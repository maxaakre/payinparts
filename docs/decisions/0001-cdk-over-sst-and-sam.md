# 1. AWS CDK over SST and SAM

**Context:** We need infrastructure as code for a small serverless app, written by one person, reviewed in an interview.

**Decision:** AWS CDK in TypeScript.

**Why:**
- Same language as the app. Types catch mistakes in infra too.
- AWS-native and common in banks. No extra vendor layer.
- Every resource is visible, so it is easy to explain what runs.
- `aws-cdk-lib/assertions` lets us unit-test IAM policies.

**Trade-offs:**
- SST has faster local dev (live Lambda). We accept slower feedback for more transparency.
- SAM/Serverless Framework are simpler but use YAML and show less TypeScript.
