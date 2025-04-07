import { Suite } from '@travetto/test';

import { SchemaWebServerSuite } from '@travetto/web/support/test/suite/schema.ts';

import { LocalAwsLambdaWebDispatcher } from '../support/test/dispatcher.ts';

@Suite()
export class AwsLambdaSchemaTest extends SchemaWebServerSuite {
  dispatcherType = LocalAwsLambdaWebDispatcher;
}