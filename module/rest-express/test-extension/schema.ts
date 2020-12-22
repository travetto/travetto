// @file-if @travetto/schema
// @file-if aws-serverless-express

import { SchemaRestServerSuite } from '@travetto/rest//schema';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressSchemaTest extends SchemaRestServerSuite {
  constructor() {
    super(3002);
  }
}

@Suite()
export class ExpressLambdaSchemaTest extends SchemaRestServerSuite {
  constructor() {
    super(true);
  }
}