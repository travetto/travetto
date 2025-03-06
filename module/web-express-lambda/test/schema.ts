import { Suite } from '@travetto/test';

import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server';
import { SchemaWebServerSuite } from '@travetto/web/support/test/schema';

@Suite()
export class ExpressLambdaSchemaTest extends SchemaWebServerSuite {
  type = AwsLambdaWebServerSupport;
}