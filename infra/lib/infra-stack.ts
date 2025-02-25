import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnGroup } from 'aws-cdk-lib/aws-resourcegroups';
import { NagSuppressions } from 'cdk-nag';
import { Frontend } from './frontend';
import { ContentHubRepo } from './content-hub-repository';
import { ThumbnailGenerator } from './thumbnail-generator';
import { ImageDetection } from './image-detection';
import { ReportingService } from './reporting-service';
import { TrafficGenerator } from './traffic-generator';
import { MonitoringConstruct } from './monitoring';
import { powertoolsServiceName, environment, Language } from './constants';

export class InfraStack extends Stack {
  public constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const language = (process.env.LANGUAGE || 'nodejs') as Language;

    new CfnGroup(this, 'resource-group', {
      name: `lambda-powertools-workshop-${environment}`,
      description: 'Resource Group for aws-lambda-powertools-workshop service',
      resourceQuery: {
        query: {
          tagFilters: [
            {
              key: 'Service',
              values: [powertoolsServiceName],
            },
          ],
        },
        type: 'TAG_FILTERS_1_0',
      },
    });

    const frontend = new Frontend(this, 'frontend', {});

    // Content Hub Repository
    const contentHubRepo = new ContentHubRepo(this, 'content-hub-repo', {
      userPool: frontend.auth.userPool,
    });
    frontend.addApiBehavior(contentHubRepo.api.domain);

    // Image Processing Module
    const thumbnailGenerator = new ThumbnailGenerator(
      this,
      'thumbnail-generator',
      {
        language,
      }
    );
    contentHubRepo.storage.grantReadWrite(
      thumbnailGenerator.functions.thumbnailGeneratorFn
    );
    contentHubRepo.storage.grantReadWriteDataOnTable(
      thumbnailGenerator.functions.thumbnailGeneratorFn
    );
    contentHubRepo.api.api.grantMutation(
      thumbnailGenerator.functions.thumbnailGeneratorFn,
      'updateFileStatus'
    );
    thumbnailGenerator.functions.thumbnailGeneratorFn.addEnvironment(
      'APPSYNC_ENDPOINT',
      `https://${contentHubRepo.api.domain}/graphql`
    );

    // Image Detection Module
    const imageDetection = new ImageDetection(this, 'image-detection', {
      filesBucket: contentHubRepo.storage.landingZoneBucket,
      filesTable: contentHubRepo.storage.filesTable,
      language,
    });

    // Reporting Service
    const reportingService = new ReportingService(this, 'reporting-service', {
      language,
    });

    imageDetection.functions.imageDetectionFn.addEnvironment(
      'API_KEY_SECRET_NAME',
      reportingService.api.apiKeySecret.secretName
    );
    reportingService.api.apiKeySecret.grantRead(
      imageDetection.functions.imageDetectionFn
    );
    imageDetection.functions.imageDetectionFn.addEnvironment(
      'API_URL_PARAMETER_NAME',
      reportingService.api.apiUrlParameter.parameterName
    );
    reportingService.api.apiUrlParameter.grantRead(
      imageDetection.functions.imageDetectionFn
    );

    // Traffic Generator Component
    const trafficGenerator = new TrafficGenerator(
      this,
      'traffic-generator',
      {}
    );
    trafficGenerator.functions.usersGeneratorFn.addEnvironment(
      'COGNITO_USER_POOL_CLIENT_ID',
      frontend.auth.userPoolClient.userPoolClientId
    );
    trafficGenerator.functions.trafficGeneratorFn.addEnvironment(
      'COGNITO_USER_POOL_ID',
      frontend.auth.userPool.userPoolId
    );
    trafficGenerator.functions.trafficGeneratorFn.addEnvironment(
      'COGNITO_USER_POOL_CLIENT_ID',
      frontend.auth.userPoolClient.userPoolClientId
    );
    trafficGenerator.functions.trafficGeneratorFn.addEnvironment(
      'API_URL',
      `https://${contentHubRepo.api.domain}/graphql`
    );
    frontend.auth.userPool.grant(
      trafficGenerator.functions.trafficGeneratorFn,
      'cognito-idp:AdminInitiateAuth'
    );

    // Monitoring
    new MonitoringConstruct(this, `monitoring-construct`, {
      tableName: contentHubRepo.storage.filesTable.tableName,
      functionName:
        thumbnailGenerator.functions.thumbnailGeneratorFn.functionName,
      deadLetterQueueName: thumbnailGenerator.queues.deadLetterQueue.queueName,
    });

    new CfnOutput(this, 'AWSRegion', {
      value: Stack.of(this).region,
    });

    [
      'InfraStack/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource',
      'InfraStack/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/DefaultPolicy/Resource',
      'InfraStack/traffic-generator/DummyUsersProvider/framework-onEvent/ServiceRole/Resource',
      'InfraStack/traffic-generator/DummyUsersProvider/framework-onEvent/ServiceRole/DefaultPolicy/Resource',
      'InfraStack/traffic-generator/DummyUsersProvider/framework-onEvent/Resource',
      'InfraStack/frontend/auth-construct/pre-signup-cognito-trigger/ServiceRole/Resource',
    ].forEach((resourcePath: string) => {
      let id = 'AwsSolutions-L1';
      let reason = 'Resource created and managed by CDK.';
      if (resourcePath.endsWith('ServiceRole/Resource')) {
        id = 'AwsSolutions-IAM4';
      } else if (resourcePath.endsWith('DefaultPolicy/Resource')) {
        id = 'AwsSolutions-IAM5';
        reason +=
          ' This type of resource is a singleton fn that interacts with many resources so IAM policies are lax by design to allow this use case.';
      }
      NagSuppressions.addResourceSuppressionsByPath(this, resourcePath, [
        {
          id,
          reason,
        },
      ]);
    });

    [
      'InfraStack/content-hub-repo/api-construct/graphql-api/lambda-get-presigned-download-url/ServiceRole/DefaultPolicy/Resource',
      'InfraStack/content-hub-repo/api-construct/graphql-api/files-table/ServiceRole/DefaultPolicy/Resource',
      'InfraStack/content-hub-repo/api-construct/graphql-api/lambda-get-presigned-upload-url/ServiceRole/DefaultPolicy/Resource',
    ].forEach((resourcePath: string) => {
      NagSuppressions.addResourceSuppressionsByPath(this, resourcePath, [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcard needed to allow generic AppSync resolvers.',
        },
      ]);
    });

    [
      'InfraStack/BucketNotificationsHandler050a0587b7544547bf325f094a3db834/Role/Resource',
      'InfraStack/BucketNotificationsHandler050a0587b7544547bf325f094a3db834/Role/DefaultPolicy/Resource',
    ].forEach((resourcePath: string) => {
      NagSuppressions.addResourceSuppressionsByPath(this, resourcePath, [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Resource created and managed by CDK.',
        },
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wildcard needed to allow generic AppSync resolvers.',
        },
      ]);
    });
  }
}
