import { Suite } from '@travetto/test';
import { WebServerSuite } from '@travetto/web/support/test/server.ts';

import { AwsLambdaWebServerSupport } from '../support/test/server-support.ts';
import { AwsLambdaWebSymbol } from '../src/server.ts';

@Suite()
export class AwsLambdaWebCoreTest extends WebServerSuite {
  type = AwsLambdaWebServerSupport;
  qualifier = AwsLambdaWebSymbol;
}