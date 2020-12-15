// @file-if @travetto/rest-session

import { AuthRestServerSuite } from '@travetto/auth-rest/test/lib/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressAuthRestTest extends AuthRestServerSuite {
  constructor() {
    super(3002);
  }
}