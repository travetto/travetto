import { Suite } from '@travetto/test';
import { SchemaWebServerSuite } from '@travetto/web/support/test/schema.ts';

import { AwsLambdaWebServerSupport } from '../support/test/server-support.ts';
import { AwsLambdaWebSymbol } from '../src/server.ts';

@Suite()
export class AwsLambdaSchemaTest extends SchemaWebServerSuite {
  type = AwsLambdaWebServerSupport;
  qualifier = AwsLambdaWebSymbol;
}