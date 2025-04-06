import { Suite } from '@travetto/test';
import { SchemaWebServerSuite } from '../support/test/suite/schema';
import { BasicWebServerSupport } from '../support/test/server-support';
import { WebInternalSymbol } from '../src/types/core.ts';

@Suite()
export class BasicSchemaTest extends SchemaWebServerSuite {
  type = BasicWebServerSupport;
  qualifier = WebInternalSymbol;
}