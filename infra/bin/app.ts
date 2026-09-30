import { App } from 'aws-cdk-lib';
import { fileURLToPath } from 'node:url';
import { PayInPartsStack } from '../lib/payinparts-stack';
import { GithubOidcStack } from '../lib/github-oidc-stack';

const app = new App();

function requireContext(name: string): string {
  const value = app.node.tryGetContext(name);
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Missing CDK context "${name}". Pass it with -c ${name}=...`);
  }
  return value;
}

const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-north-1' };

new PayInPartsStack(app, 'PayInParts', {
  env,
  alertEmail: requireContext('alertEmail'),
  modelId: requireContext('modelId'),
  webAssetPath: fileURLToPath(new URL('../../apps/web/dist', import.meta.url)),
});

new GithubOidcStack(app, 'PayInPartsGithubOidc', { env, githubRepo: requireContext('githubRepo') });
