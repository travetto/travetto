// @file-if @vendia/serverless-express

import { SchemaRestServerSuite } from '@travetto/rest/test-support/schema';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressSchemaTest extends SchemaRestServerSuite { }

@Suite()
export class ExpressLambdaSchemaTest extends SchemaRestServerSuite {
  type = 'lambda';
}