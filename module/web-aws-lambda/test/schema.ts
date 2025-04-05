import { Suite } from '@travetto/test';
import { SchemaWebServerSuite } from '@travetto/web/support/test/suite/schema.ts';

import { AwsLambdaWebServerSupport } from '../support/test/server-support.ts';

@Suite()
export class AwsLambdaSchemaTest extends SchemaWebServerSuite {
  type = AwsLambdaWebServerSupport;
}