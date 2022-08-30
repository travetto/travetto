// @with-module @travetto/auth-rest
// @with-module @fastify/aws-lambda
import { AuthRestServerSuite } from '@travetto/auth-rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class FastifyAuthRestTest extends AuthRestServerSuite { }

@Suite()
export class FastifyLambdaAuthRestTest extends AuthRestServerSuite {
  type = 'lambda';
}