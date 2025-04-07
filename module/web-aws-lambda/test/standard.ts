import { Suite } from '@travetto/test';

import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';

import { LocalAwsLambdaWebDispatcher } from '../support/test/dispatcher.ts';

@Suite()
export class AwsLambdaWebCoreTest extends StandardWebServerSuite {
  dispatcherType = LocalAwsLambdaWebDispatcher;
}