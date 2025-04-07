import { Suite } from '@travetto/test';
import { StandardWebServerSuite } from '../support/test/suite/standard.ts';
import { BasicWebDispatcher } from '../support/test/dispatcher.ts';

@Suite()
export class BasicStandardTest extends StandardWebServerSuite {
  dispatcherType = BasicWebDispatcher;
}