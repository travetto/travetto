import { Suite } from '@travetto/test';

import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';
import { LocalAwsLambdaWebDispatcher } from '@travetto/web-aws-lambda/support/test/dispatcher.ts';

@Suite()
class AwsLambdaWebCoreTest extends StandardWebServerSuite {
  dispatcherType = LocalAwsLambdaWebDispatcher;
}