import { Suite } from '@travetto/test';
import { StandardWebServerSuite } from '../support/test/suite/standard.ts';
import { BasicWebRouter } from '../support/test/test-router.ts';

@Suite()
export class BasicStandardTest extends StandardWebServerSuite {
  routerType = BasicWebRouter;
}