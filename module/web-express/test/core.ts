import { Suite } from '@travetto/test';
import { WebServerSuite } from '@travetto/web/support/test/server.ts';

@Suite()
export class ExpressWebCoreTest extends WebServerSuite { }