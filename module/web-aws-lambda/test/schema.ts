import { Suite } from '@travetto/test';

import { LocalAwsLambdaWebDispatcher } from '@travetto/web-aws-lambda/support/test/dispatcher.ts';
import { SchemaWebServerSuite } from '@travetto/web/support/test/suite/schema.ts';

@Suite()
class AwsLambdaSchemaTest extends SchemaWebServerSuite {
  dispatcherType = LocalAwsLambdaWebDispatcher;
}
