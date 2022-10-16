// @with-module @travetto/auth-rest
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/server';
import { AuthRestServerSuite } from '@travetto/auth-rest/support/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressLambdaAuthRestTest extends AuthRestServerSuite {
  type = AwsLambdaRestServerSupport;
}