import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { CfnStage, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { fileURLToPath } from 'node:url';

const handlersDir = fileURLToPath(new URL('../../services/api/src/handlers/', import.meta.url));

export interface ApiProps {
  table: ITable;
  modelId: string;
}

export class ApiConstruct extends Construct {
  readonly api: HttpApi;
  readonly functions: Record<'products' | 'orders' | 'creditCheck' | 'explainPlan', NodejsFunction>;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);
    const { region, account } = Stack.of(this);

    const makeFn = (id: string, file: string, extraEnv: Record<string, string> = {}, timeout = Duration.seconds(10)) =>
      new NodejsFunction(this, id, {
        entry: `${handlersDir}${file}.ts`,
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 512,
        timeout,
        tracing: lambda.Tracing.ACTIVE,
        logGroup: new logs.LogGroup(this, `${id}Logs`, {
          retention: logs.RetentionDays.ONE_MONTH,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        environment: {
          TABLE_NAME: props.table.tableName,
          POWERTOOLS_SERVICE_NAME: file,
          POWERTOOLS_METRICS_NAMESPACE: 'PayInParts',
          NODE_OPTIONS: '--enable-source-maps',
          ...extraEnv,
        },
        bundling: { minify: true, sourceMap: true },
      });

    const products = makeFn('Products', 'products');
    const orders = makeFn('Orders', 'orders');
    const creditCheck = makeFn('CreditCheck', 'credit-check');
    const explainPlan = makeFn('ExplainPlan', 'explain-plan', { MODEL_ID: props.modelId }, Duration.seconds(20));
    this.functions = { products, orders, creditCheck, explainPlan };

    // Least privilege: each function gets only the table actions it uses
    props.table.grant(orders, 'dynamodb:PutItem', 'dynamodb:Query', 'dynamodb:UpdateItem');
    props.table.grant(creditCheck, 'dynamodb:GetItem', 'dynamodb:PutItem');
    props.table.grant(explainPlan, 'dynamodb:GetItem', 'dynamodb:UpdateItem');

    // The EU inference profile routes to the model in several EU regions
    const foundationModelId = props.modelId.replace(/^(eu|us|apac|global)\./, '');
    explainPlan.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${region}:${account}:inference-profile/${props.modelId}`,
          `arn:aws:bedrock:*::foundation-model/${foundationModelId}`,
        ],
      }),
    );

    this.api = new HttpApi(this, 'HttpApi', { apiName: 'payinparts' });
    const integration = (fn: NodejsFunction) => new HttpLambdaIntegration(`${fn.node.id}Integration`, fn);
    const ordersIntegration = integration(orders);

    this.api.addRoutes({ path: '/api/products', methods: [HttpMethod.GET], integration: integration(products) });
    this.api.addRoutes({ path: '/api/orders', methods: [HttpMethod.POST], integration: ordersIntegration });
    this.api.addRoutes({ path: '/api/orders/{id}', methods: [HttpMethod.GET], integration: ordersIntegration });
    this.api.addRoutes({ path: '/api/orders/{id}/confirm', methods: [HttpMethod.POST], integration: ordersIntegration });
    this.api.addRoutes({ path: '/api/orders/{id}/credit-check', methods: [HttpMethod.POST], integration: integration(creditCheck) });
    const explainRoutes = this.api.addRoutes({ path: '/api/orders/{id}/explain', methods: [HttpMethod.POST], integration: integration(explainPlan) });

    // Throttling: RouteSettings is raw CloudFormation JSON, so keys use CFN casing
    const stage = this.api.defaultStage!.node.defaultChild as CfnStage;
    stage.defaultRouteSettings = { throttlingRateLimit: 20, throttlingBurstLimit: 40 };
    stage.routeSettings = {
      'POST /api/orders/{id}/explain': { ThrottlingRateLimit: 1, ThrottlingBurstLimit: 2 },
    };
    // RouteSettings may only name routes that already exist, so create them first
    for (const route of explainRoutes) stage.node.addDependency(route);
  }
}
