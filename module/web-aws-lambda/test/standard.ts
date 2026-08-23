import { Suite } from '@travetto/test';

import { LocalAwsLambdaWebDispatcher } from '@travetto/web-aws-lambda/support/test/dispatcher.ts';
import { StandardWebServerSuite } from '@travetto/web/support/test/suite/standard.ts';

@Suite()
class AwsLambdaWebCoreTest extends StandardWebServerSuite {
  dispatcherType = LocalAwsLambdaWebDispatcher;
}
