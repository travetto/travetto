import { Suite } from '@travetto/test';
import { SchemaWebServerSuite } from '@travetto/web/support/test/schema.ts';
import { NodeWebServerSupport } from '../support/test/server-support.ts';

@Suite()
export class NodeSchemaTest extends SchemaWebServerSuite {
  type = NodeWebServerSupport;
}