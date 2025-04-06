import { Suite } from '@travetto/test';

import { SchemaWebServerSuite } from '@travetto/web/support/test/suite/schema.ts';

import { LocalAwsLambdaWebRouter } from '../support/test/router.ts';

@Suite()
export class AwsLambdaSchemaTest extends SchemaWebServerSuite {
  routerType = LocalAwsLambdaWebRouter;
}