import { SchemaWebServerSuite } from '@travetto/web/support/test/schema';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server';
import { Suite } from '@travetto/test';

@Suite()
export class KoaLambdaSchemaTest extends SchemaWebServerSuite {
  type = AwsLambdaWebServerSupport;
}