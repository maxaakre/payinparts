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

  const arn = (name: string) => `arn:aws:iam::123456789012:role/cdk-hnb659fds-${name}-123456789012-eu-north-1`;

  const statementsFor = (roleLogicalPrefix: string) => {
    const policies = Object.values(template.findResources('AWS::IAM::Policy')).filter((p) =>
      JSON.stringify(p.Properties.Roles).includes(roleLogicalPrefix),
    );
    expect(policies.length).toBe(1);
    return policies[0]!.Properties.PolicyDocument.Statement as Array<Record<string, unknown>>;
  };

  const expectOnlyAssume = (statements: Array<Record<string, unknown>>, resources: string[]) => {
    expect(statements.length).toBe(1);
    const [s] = statements;
    expect(s!.Effect).toBe('Allow');
    expect(s!.Action).toBe('sts:AssumeRole');
    expect([s!.Resource].flat().sort()).toEqual([...resources].sort());
  };

  it('deploy role can only assume the four CDK bootstrap roles', () => {
    expectOnlyAssume(
      statementsFor('GithubDeployRole'),
      ['deploy-role', 'file-publishing-role', 'image-publishing-role', 'lookup-role'].map(arn),
    );
  });

  it('diff role can only assume the CDK lookup role', () => {
    expectOnlyAssume(statementsFor('GithubDiffRole'), [arn('lookup-role')]);
  });

  it('roles have no managed policies attached', () => {
    const roles = template.findResources('AWS::IAM::Role', {
      Properties: { RoleName: Match.stringLikeRegexp('^payinparts-github-') },
    });
    expect(Object.keys(roles).length).toBe(2);
    for (const r of Object.values(roles)) {
      expect(r.Properties.ManagedPolicyArns).toBeUndefined();
    }
  });
});
