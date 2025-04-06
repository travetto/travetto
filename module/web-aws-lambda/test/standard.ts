import { Suite } from '@travetto/test';

import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';

import { LocalAwsLambdaWebRouter } from '../support/test/router.ts';

@Suite()
export class AwsLambdaWebCoreTest extends StandardWebServerSuite {
  routerType = LocalAwsLambdaWebRouter;
}