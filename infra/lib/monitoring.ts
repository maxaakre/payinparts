import { Duration } from 'aws-cdk-lib';
import type { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface MonitoringProps {
  api: HttpApi;
  functions: Record<string, IFunction>;
  alertEmail: string;
}

const NAMESPACE = 'PayInParts';
const period = Duration.minutes(5);

const appMetric = (metricName: string, service: string, extra: Record<string, string> = {}, label?: string) =>
  new cw.Metric({ namespace: NAMESPACE, metricName, dimensionsMap: { service, ...extra }, statistic: 'Sum', period, label });

export class MonitoringConstruct extends Construct {
  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    const topic = new sns.Topic(this, 'Alerts');
    topic.addSubscription(new subs.EmailSubscription(props.alertEmail));
    const notify = new actions.SnsAction(topic);

    const fns = Object.entries(props.functions);
    for (const [name, fn] of fns) {
      fn.metricErrors({ period })
        .createAlarm(this, `${name}Errors`, {
          threshold: 1,
          evaluationPeriods: 1,
          treatMissingData: cw.TreatMissingData.NOT_BREACHING,
          // httpHandler turns app errors into 500 responses, so this only catches timeouts, init failures and OOM
        alarmDescription: `${name} Lambda timeouts, init failures or OOM (app errors show up in the API 5xx alarm)`,
        })
        .addAlarmAction(notify);
    }

    props.api
      .metricServerError({ period })
      .createAlarm(this, 'Api5xx', {
        threshold: 5,
        evaluationPeriods: 1,
        treatMissingData: cw.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'API is returning 5xx errors',
      })
      .addAlarmAction(notify);

    // Spend guard: the daily cap is 500 questions, so 200 in an hour is unusual
    new cw.Metric({
      namespace: NAMESPACE,
      metricName: 'AiQuestions',
      dimensionsMap: { service: 'explain-plan' },
      statistic: 'Sum',
      period: Duration.hours(1),
    })
      .createAlarm(this, 'AiQuestionsHigh', {
        threshold: 200,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1,
        treatMissingData: cw.TreatMissingData.NOT_BREACHING,
        alarmDescription: 'More than 200 AI questions in one hour',
      })
      .addAlarmAction(notify);

    const dashboard = new cw.Dashboard(this, 'Dashboard', { dashboardName: 'PayInParts' });
    dashboard.addWidgets(
      new cw.GraphWidget({
        title: 'API requests and errors',
        left: [props.api.metricCount({ period })],
        right: [props.api.metricClientError({ period }), props.api.metricServerError({ period })],
      }),
      new cw.GraphWidget({
        title: 'API latency',
        left: [props.api.metricLatency({ period, statistic: 'p50' }), props.api.metricLatency({ period, statistic: 'p95' })],
      }),
    );
    dashboard.addWidgets(
      new cw.GraphWidget({ title: 'Lambda errors', left: fns.map(([, fn]) => fn.metricErrors({ period })) }),
      new cw.GraphWidget({ title: 'Lambda duration p95', left: fns.map(([, fn]) => fn.metricDuration({ period, statistic: 'p95' })) }),
    );
    dashboard.addWidgets(
      new cw.GraphWidget({
        title: 'Credit decisions',
        left: ['approved', 'approved_lower_limit', 'declined'].map((r) =>
          appMetric('CreditDecision', 'credit-check', { Result: r }, r),
        ),
      }),
      new cw.GraphWidget({
        title: 'AI usage',
        left: [appMetric('AiQuestions', 'explain-plan')],
        right: [appMetric('AiInputTokens', 'explain-plan'), appMetric('AiOutputTokens', 'explain-plan')],
      }),
    );
  }
}
