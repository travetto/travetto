// @file-if @fastify/aws-lambda

import { SchemaRestServerSuite } from '@travetto/rest/test-support/schema';
import { Suite } from '@travetto/test';

@Suite()
export class FastifySchemaTest extends SchemaRestServerSuite { }

@Suite()
export class FastifyLambdaSchemaTest extends SchemaRestServerSuite {
  type = 'lambda';
}