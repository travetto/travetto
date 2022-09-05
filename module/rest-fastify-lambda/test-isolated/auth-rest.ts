// @with-module @travetto/auth-rest
import { AuthRestServerSuite } from '@travetto/auth-rest/test-support/server';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyAuthRestTest extends AuthRestServerSuite { }

@Suite()
export class FastifyLambdaAuthRestTest extends AuthRestServerSuite {
  type = AwsLambdaRestServerSupport;
}