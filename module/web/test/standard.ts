import { Suite } from '@travetto/test';

import { StandardWebServerSuite } from '../support/test/suite/standard.ts';
import { LocalRequestDispatcher } from '../support/test/dispatcher.ts';

@Suite()
export class BasicStandardTest extends StandardWebServerSuite {
  dispatcherType = LocalRequestDispatcher;
}