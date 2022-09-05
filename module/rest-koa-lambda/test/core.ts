import { RestServerSuite } from '@travetto/rest/test-support/server';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaRestCoreTest extends RestServerSuite {
  type = AwsLambdaRestServerSupport;
}