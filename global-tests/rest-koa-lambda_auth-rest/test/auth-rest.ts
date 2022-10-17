import { AuthRestServerSuite } from '@travetto/auth-rest/support/test.server';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test.server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaAuthRestTest extends AuthRestServerSuite { }

@Suite()
export class KoaLambdaAuthRestTest extends AuthRestServerSuite {
  type = AwsLambdaRestServerSupport;
}
