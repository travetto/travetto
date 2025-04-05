import { Suite } from '@travetto/test';

import { SchemaWebServerSuite } from '@travetto/web/support/test/schema.ts';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server.ts';

@Suite()
export class FastifyLambdaSchemaTest extends SchemaWebServerSuite {
  type = AwsLambdaWebServerSupport;
}