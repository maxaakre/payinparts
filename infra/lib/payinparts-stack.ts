import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';
import { ApiConstruct } from './api';
import { MonitoringConstruct } from './monitoring';
import { WebConstruct } from './web';

export interface PayInPartsStackProps extends StackProps {
  alertEmail: string;
  modelId: string;
  webAssetPath: string;
}

export class PayInPartsStack extends Stack {
  constructor(scope: Construct, id: string, props: PayInPartsStackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // demo data only
    });

    const api = new ApiConstruct(this, 'Api', { table, modelId: props.modelId });
    const web = new WebConstruct(this, 'Web', { api: api.api, webAssetPath: props.webAssetPath });
    new MonitoringConstruct(this, 'Monitoring', { api: api.api, functions: api.functions, alertEmail: props.alertEmail });

    new CfnOutput(this, 'SiteUrl', { value: `https://${web.distribution.distributionDomainName}` });
  }
}
