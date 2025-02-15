import { logger } from '@commons/powertools';
import middy from '@middy/core';
import { injectLambdaContext } from '@aws-lambda-powertools/logger';

export const handler = middy(async (_event) => {}).use(
  injectLambdaContext(logger, { logEvent: true })
);
