// @with-module @travetto/auth-rest

import { AuthRestServerSuite } from '@travetto/auth-rest/support/server';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressAuthRestTest extends AuthRestServerSuite { }