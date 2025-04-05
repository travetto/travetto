import { Suite } from '@travetto/test';
import { StandardWebServerSuite } from '../support/test/suite/standard.ts';
import { BasicWebServerSupport } from '../support/test/server-support.ts';
import { WebInternalSymbol } from '../src/types/core.ts';

@Suite()
export class BasicStandardTest extends StandardWebServerSuite {
  type = BasicWebServerSupport;
  qualifier = WebInternalSymbol;
}