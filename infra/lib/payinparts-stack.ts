import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';
import { ApiConstruct } from './api';

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

    new ApiConstruct(this, 'Api', { table, modelId: props.modelId });
  }
}
