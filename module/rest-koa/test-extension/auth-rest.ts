// @file-if @travetto/auth-rest
// @file-if aws-serverless-express

import { AuthRestServerSuite } from '@travetto/auth-rest/test-support/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaAuthRestTest extends AuthRestServerSuite {
  constructor() {
    super(3004);
  }
}

@Suite()
export class KoaLambdaAuthRestTest extends AuthRestServerSuite {
  constructor() {
    super(true);
  }
}