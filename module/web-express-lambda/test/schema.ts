import { Suite } from '@travetto/test';

import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server.ts';
import { SchemaWebServerSuite } from '@travetto/web/support/test/schema.ts';

@Suite()
export class ExpressLambdaSchemaTest extends SchemaWebServerSuite {
  type = AwsLambdaWebServerSupport;
}