// @file-if @travetto/auth-rest
// @file-if aws-serverless-express

import { AuthRestServerSuite } from '@travetto/auth-rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaAuthRestTest extends AuthRestServerSuite { }

@Suite()
export class KoaLambdaAuthRestTest extends AuthRestServerSuite {
  type = 'lambda';
}