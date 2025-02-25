import { Suite } from '@travetto/test';

import { RestServerSuite } from '@travetto/rest/support/test/server';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server';

@Suite()
export class KoaRestCoreTest extends RestServerSuite {
  type = AwsLambdaRestServerSupport;
}