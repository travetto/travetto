import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test.server';
import { AuthRestServerSuite } from '@travetto/auth-rest/support/test.server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressLambdaAuthRestTest extends AuthRestServerSuite {
  type = AwsLambdaRestServerSupport;
}
