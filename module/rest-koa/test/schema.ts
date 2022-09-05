import { SchemaRestServerSuite } from '@travetto/rest/test-support/schema';
import { Suite } from '@travetto/test';

@Suite()
export class KoaSchemaTest extends SchemaRestServerSuite { }

@Suite()
export class KoaLambdaSchemaTest extends SchemaRestServerSuite {
  type = 'lambda';
}