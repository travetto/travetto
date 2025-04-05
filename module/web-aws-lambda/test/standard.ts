import { Suite } from '@travetto/test';
import { StandardWebServerSuite } from '@travetto/web/support/test/standard-suite.ts';

import { AwsLambdaWebServerSupport } from '../support/test/server-support.ts';

@Suite()
export class AwsLambdaWebCoreTest extends StandardWebServerSuite {
  type = AwsLambdaWebServerSupport;
}