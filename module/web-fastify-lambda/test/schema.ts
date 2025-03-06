import { Suite } from '@travetto/test';

import { SchemaWebServerSuite } from '@travetto/web/support/test/schema';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server';

@Suite()
export class FastifyLambdaSchemaTest extends SchemaWebServerSuite {
  type = AwsLambdaWebServerSupport;
}