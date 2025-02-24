import { RestServerSuite } from '@travetto/rest/support/test/server.ts';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server.ts';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressRestCoreLambdaTest extends RestServerSuite {
  type = AwsLambdaRestServerSupport;
}