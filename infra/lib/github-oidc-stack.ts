import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface GithubOidcStackProps extends StackProps {
  /** "owner/repo" */
  githubRepo: string;
  /**
   * OIDC `sub` prefix. Defaults to `repo:<owner>/<repo>`. Repos with GitHub's immutable
   * subject claims send `repo:<owner>@<id>/<repo>@<id>` instead, which survives renames
   * and blocks repo-resurrection takeovers.
   */
  githubSubjectPrefix?: string;
}

/** Lets GitHub Actions get short-lived AWS credentials. No access keys are stored in GitHub. */
export class GithubOidcStack extends Stack {
  constructor(scope: Construct, id: string, props: GithubOidcStackProps) {
    super(scope, id, props);
    const { account, region } = this;
    const subjectPrefix = props.githubSubjectPrefix ?? `repo:${props.githubRepo}`;

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

    const bootstrapRoleArn = (name: string) => `arn:aws:iam::${account}:role/cdk-hnb659fds-${name}-${account}-${region}`;

    // Deploy: may only hop into the four CDK bootstrap roles (deploy, file publishing, image publishing, lookup)
    const deployRole = new iam.Role(this, 'GithubDeployRole', {
      roleName: 'payinparts-github-deploy',
      assumedBy: trust(`${subjectPrefix}:ref:refs/heads/main`),
      maxSessionDuration: Duration.hours(1),
    });
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: ['deploy-role', 'file-publishing-role', 'image-publishing-role', 'lookup-role'].map(bootstrapRoleArn),
      }),
    );

    // PR diff: read-only lookup role only
    const diffRole = new iam.Role(this, 'GithubDiffRole', {
      roleName: 'payinparts-github-diff',
      assumedBy: trust(`${subjectPrefix}:pull_request`),
      maxSessionDuration: Duration.hours(1),
    });
    diffRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [bootstrapRoleArn('lookup-role')],
      }),
    );
  }
}
