import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { GithubOidcStack } from '../lib/github-oidc-stack';

const app = new App();
const template = Template.fromStack(
  new GithubOidcStack(app, 'Oidc', { env: { account: '123456789012', region: 'eu-north-1' }, githubRepo: 'acme/resurs-demo' }),
);

const trustFor = (sub: string) => ({
  AssumeRolePolicyDocument: Match.objectLike({
    Statement: Match.arrayWith([
      Match.objectLike({
        Condition: {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            'token.actions.githubusercontent.com:sub': sub,
          },
        },
      }),
    ]),
  }),
});

describe('GitHub OIDC', () => {
  it('deploy role trusts only the main branch', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'payinparts-github-deploy',
      ...trustFor('repo:acme/resurs-demo:ref:refs/heads/main'),
    });
  });

  it('diff role trusts only pull requests', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'payinparts-github-diff',
      ...trustFor('repo:acme/resurs-demo:pull_request'),
    });
  });

  it('roles can only assume CDK bootstrap roles', () => {
    const policies = Object.values(template.findResources('AWS::IAM::Policy')).filter((p) =>
      JSON.stringify(p.Properties.Roles).includes('Github'),
    );
    expect(policies.length).toBe(2);
    for (const p of policies) {
      for (const s of p.Properties.PolicyDocument.Statement) {
        expect(s.Action).toBe('sts:AssumeRole');
      }
    }
  });
});
