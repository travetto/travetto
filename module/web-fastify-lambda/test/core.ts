import { Suite } from '@travetto/test';

import { WebServerSuite } from '@travetto/web/support/test/server.ts';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server.ts';

@Suite()
export class FastifyWebLambdaTest extends WebServerSuite {
  type = AwsLambdaWebServerSupport;
}