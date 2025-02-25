import { Suite } from '@travetto/test';

import { SchemaRestServerSuite } from '@travetto/rest/support/test/schema.ts';

@Suite()
export class ExpressSchemaTest extends SchemaRestServerSuite { }