// @file-if @travetto/schema
// @file-if aws-serverless-express

import { SchemaRestServerSuite } from '@travetto/rest/test-support/schema';
import { Suite } from '@travetto/test';

@Suite()
export class KoaSchemaTest extends SchemaRestServerSuite {
  constructor() {
    super(3004);
  }
}

@Suite()
export class KoaLambdaSchemaTest extends SchemaRestServerSuite {
  constructor() {
    super(true);
  }
}