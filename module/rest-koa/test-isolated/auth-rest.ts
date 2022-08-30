// @with-module @travetto/auth-rest
// @with-module @vendia/serverless-express

import { AuthRestServerSuite } from '@travetto/auth-rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaAuthRestTest extends AuthRestServerSuite { }

@Suite()
export class KoaLambdaAuthRestTest extends AuthRestServerSuite {
  type = 'lambda';
}