// @file-if @travetto/schema
// @file-if aws-lambda-fastify

import { SchemaRestServerSuite } from '@travetto/rest/test-support/schema';
import { Suite } from '@travetto/test';

@Suite()
export class FastifySchemaTest extends SchemaRestServerSuite { }

@Suite()
export class FastifyLambdaSchemaTest extends SchemaRestServerSuite {
  type = 'lamdba';
}