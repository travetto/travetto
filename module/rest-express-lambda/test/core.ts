import { RestServerSuite } from '@travetto/rest/support/test/server';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressRestCoreLambdaTest extends RestServerSuite {
  type = AwsLambdaRestServerSupport;
}