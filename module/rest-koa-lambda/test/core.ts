import { RestServerSuite } from '@travetto/rest/support/test/server';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaRestCoreTest extends RestServerSuite {
  type = AwsLambdaRestServerSupport;
}