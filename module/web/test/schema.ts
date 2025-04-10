import { Suite } from '@travetto/test';
import { SchemaWebServerSuite } from '../support/test/suite/schema';
import { StandardWebRouter } from '../src/router/standard.ts';

@Suite()
export class BasicSchemaTest extends SchemaWebServerSuite {
  dispatcherType = StandardWebRouter;
}