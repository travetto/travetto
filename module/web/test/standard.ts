import { Suite } from '@travetto/test';
import { StandardWebServerSuite } from '../support/test/suite/standard.ts';
import { StandardWebRouter } from '../src/router/standard.ts';

@Suite()
export class BasicStandardTest extends StandardWebServerSuite {
  dispatcherType = StandardWebRouter;
}