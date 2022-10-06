// @with-module @travetto/auth-rest
import { AuthRestServerSuite } from '@travetto/auth-rest/test-support/server';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaAuthRestTest extends AuthRestServerSuite { }

@Suite()
export class KoaLambdaAuthRestTest extends AuthRestServerSuite {
  type = AwsLambdaRestServerSupport;
}