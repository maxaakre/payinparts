import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { PayInPartsStack } from '../lib/payinparts-stack';

let template: Template;

beforeAll(() => {
  const app = new App();
  const stack = new PayInPartsStack(app, 'Test', {
    env: { account: '123456789012', region: 'eu-north-1' },
    alertEmail: 'test@example.com',
    modelId: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
    webAssetPath: fileURLToPath(new URL('./fixtures/web', import.meta.url)),
  });
  template = Template.fromStack(stack);
});

/** All IAM policy documents whose logical id starts with the given prefix, as JSON text. */
function policiesFor(prefix: string): string[] {
  return Object.entries(template.findResources('AWS::IAM::Policy'))
    .filter(([logicalId]) => logicalId.startsWith(prefix))
    .map(([, resource]) => JSON.stringify(resource.Properties.PolicyDocument));
}

describe('least-privilege IAM', () => {
  it('only explain-plan can call Bedrock', () => {
    const withBedrock = Object.entries(template.findResources('AWS::IAM::Policy')).filter(([, r]) =>
      JSON.stringify(r.Properties.PolicyDocument).includes('bedrock:InvokeModel'),
    );
    expect(withBedrock).toHaveLength(1);
    expect(withBedrock[0]![0]).toMatch(/^ApiExplainPlan/);
  });

  it('Bedrock access is limited to the chosen model', () => {
    const statements = Object.entries(template.findResources('AWS::IAM::Policy'))
      .filter(([logicalId]) => logicalId.startsWith('ApiExplainPlan'))
      .flatMap(([, r]) => r.Properties.PolicyDocument.Statement);
    const bedrock = statements.find((s: { Action: unknown }) => s.Action === 'bedrock:InvokeModel');
    // X-Ray needs Resource "*", but the Bedrock statement must not
    expect(bedrock.Resource).not.toContain('*');
    const resources = JSON.stringify(bedrock.Resource);
    expect(resources).toContain('inference-profile/eu.anthropic.claude-haiku-4-5-20251001-v1:0');
    expect(resources).toContain('foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0');
  });

  it('products has no DynamoDB access', () => {
    const docs = policiesFor('ApiProducts');
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.join()).not.toContain('dynamodb:');
  });

  it('orders can put, query and update but not get', () => {
    const docs = policiesFor('ApiOrders');
    expect(docs.length).toBeGreaterThan(0);
    const doc = docs.join();
    for (const action of ['PutItem', 'Query', 'UpdateItem']) expect(doc).toContain(`dynamodb:${action}`);
    expect(doc).not.toContain('dynamodb:GetItem');
    expect(doc).not.toContain('dynamodb:*');
    expect(doc).not.toContain('dynamodb:Scan');
  });

  it('explain-plan can only get and update', () => {
    const docs = policiesFor('ApiExplainPlan');
    expect(docs.length).toBeGreaterThan(0);
    const doc = docs.join();
    expect(doc).toContain('dynamodb:GetItem');
    expect(doc).toContain('dynamodb:UpdateItem');
    expect(doc).not.toContain('dynamodb:PutItem');
    expect(doc).not.toContain('dynamodb:*');
    expect(doc).not.toContain('dynamodb:Scan');
  });

  it('credit-check can only read and put', () => {
    const docs = policiesFor('ApiCreditCheck');
    expect(docs.length).toBeGreaterThan(0);
    const doc = docs.join();
    expect(doc).toContain('dynamodb:GetItem');
    expect(doc).toContain('dynamodb:PutItem');
    expect(doc).not.toContain('dynamodb:UpdateItem');
    expect(doc).not.toContain('dynamodb:DeleteItem');
    expect(doc).not.toContain('dynamodb:*');
    expect(doc).not.toContain('dynamodb:Scan');
  });

  it('no app function can delete data', () => {
    const docs = policiesFor('Api');
    expect(docs.length).toBeGreaterThan(0);
    for (const action of ['DeleteItem', '*', 'Scan']) expect(docs.join()).not.toContain(`dynamodb:${action}`);
  });
});

describe('API', () => {
  it('has all routes', () => {
    for (const route of [
      'GET /api/products',
      'POST /api/orders',
      'GET /api/orders/{id}',
      'POST /api/orders/{id}/confirm',
      'POST /api/orders/{id}/credit-check',
      'POST /api/orders/{id}/explain',
    ]) {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: route });
    }
  });

  it('throttles the AI route harder than the rest', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: { ThrottlingRateLimit: 20, ThrottlingBurstLimit: 40 },
      RouteSettings: Match.objectLike({
        'POST /api/orders/{id}/explain': { ThrottlingRateLimit: 1, ThrottlingBurstLimit: 2 },
      }),
    });
  });

  it('runs Lambdas on Node 22 with tracing', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      TracingConfig: { Mode: 'Active' },
      Environment: { Variables: Match.objectLike({ POWERTOOLS_SERVICE_NAME: 'explain-plan', MODEL_ID: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0' }) },
    });
  });

  it('uses on-demand DynamoDB', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', { BillingMode: 'PAY_PER_REQUEST' });
  });
});

describe('web hosting', () => {
  it('keeps the site bucket private', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('routes /api/* to the HTTP API without caching', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({
            PathPattern: '/api/*',
            ViewerProtocolPolicy: 'https-only',
            CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // Managed-CachingDisabled
          }),
        ]),
      }),
    });
  });

  it('rewrites only extension-less paths to index.html', () => {
    const fns = Object.values(template.findResources('AWS::CloudFront::Function'));
    expect(fns).toHaveLength(1);
    expect(fns[0]!.Properties.FunctionCode).toContain("indexOf('.')");
  });

  it('outputs the site URL', () => {
    template.hasOutput('SiteUrl', {});
  });
});

describe('monitoring', () => {
  it('sends alarms to the alert email', () => {
    template.hasResourceProperties('AWS::SNS::Subscription', { Protocol: 'email', Endpoint: 'test@example.com' });
  });

  it('has an error alarm per function and an API 5xx alarm', () => {
    const alarms = Object.values(template.findResources('AWS::CloudWatch::Alarm'));
    expect(alarms.length).toBeGreaterThanOrEqual(6);
  });

  it('alarms when AI usage spikes within an hour', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      Namespace: 'PayInParts',
      MetricName: 'AiQuestions',
      Dimensions: [{ Name: 'service', Value: 'explain-plan' }],
      Statistic: 'Sum',
      Period: 3600,
      Threshold: 200,
      ComparisonOperator: 'GreaterThanThreshold',
      AlarmActions: Match.anyValue(),
    });
  });

  it('has a dashboard', () => {
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', { DashboardName: 'PayInParts' });
  });
});
