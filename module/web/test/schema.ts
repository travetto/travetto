import { Suite } from '@travetto/test';
import { SchemaWebServerSuite } from '../support/test/suite/schema';
import { BasicWebRouter } from '../support/test/test-router.ts';

@Suite()
export class BasicSchemaTest extends SchemaWebServerSuite {
  routerType = BasicWebRouter;
}