import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface GithubOidcStackProps extends StackProps {
  /** "owner/repo" */
  githubRepo: string;
}

/** Lets GitHub Actions get short-lived AWS credentials. No access keys are stored in GitHub. */
export class GithubOidcStack extends Stack {
  constructor(scope: Construct, id: string, props: GithubOidcStackProps) {
    super(scope, id, props);
    const { account, region } = this;

    const provider = new iam.OpenIdConnectProvider(this, 'GithubProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const trust = (sub: string) =>
      new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': sub,
        },
      });

    // Deploy: may only hop into the CDK bootstrap roles (deploy, file publishing, lookup)
    const deployRole = new iam.Role(this, 'GithubDeployRole', {
      roleName: 'payinparts-github-deploy',
      assumedBy: trust(`repo:${props.githubRepo}:ref:refs/heads/main`),
      maxSessionDuration: Duration.hours(1),
    });
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${account}:role/cdk-hnb659fds-*-${account}-${region}`],
      }),
    );

    // PR diff: read-only lookup role only
    const diffRole = new iam.Role(this, 'GithubDiffRole', {
      roleName: 'payinparts-github-diff',
      assumedBy: trust(`repo:${props.githubRepo}:pull_request`),
      maxSessionDuration: Duration.hours(1),
    });
    diffRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${account}:role/cdk-hnb659fds-lookup-role-${account}-${region}`],
      }),
    );
  }
}
