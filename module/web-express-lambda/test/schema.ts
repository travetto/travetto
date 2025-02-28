import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server';
import { SchemaWebServerSuite } from '@travetto/web/support/test/schema';
import { Suite } from '@travetto/test';

@Suite()
export class ExpressLambdaSchemaTest extends SchemaWebServerSuite {
  type = AwsLambdaWebServerSupport;
}