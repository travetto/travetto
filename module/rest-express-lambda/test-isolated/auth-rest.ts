// @with-module @travetto/auth-rest
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/test-support/server';
import { AuthRestServerSuite } from '@travetto/auth-rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressLambdaAuthRestTest extends AuthRestServerSuite {
  type = AwsLambdaRestServerSupport;
}