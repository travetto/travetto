import { Suite } from '@travetto/test';

import { RestServerSuite } from '@travetto/rest/support/test/server.ts';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server.ts';

@Suite()
export class FastifyRestLambdaTest extends RestServerSuite {
  type = AwsLambdaRestServerSupport;
}