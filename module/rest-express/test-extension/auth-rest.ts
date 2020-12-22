// @file-if @travetto/auth-rest
// @file-if aws-serverless-express

import { AuthRestServerSuite } from '@travetto/auth-rest//server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressAuthRestTest extends AuthRestServerSuite {
  constructor() {
    super(3002);
  }
}


@Suite()
export class ExpressLambdaAuthRestTest extends AuthRestServerSuite {
  constructor() {
    super(true);
  }
}