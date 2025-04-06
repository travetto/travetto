import { Suite } from '@travetto/test';
import { AwsLambdaWebServer } from '@travetto/web-aws-lambda';
import { InjectableFactory } from '@travetto/di';
import { WebApplication } from '@travetto/web';

import { AuthWebServerSuite } from '@travetto/auth-web/support/test/server.ts';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server-support.ts';

const ServerSymbol = Symbol.for('aws-lambda');

class Config {
  @InjectableFactory(ServerSymbol)
  static getApp(dep: AwsLambdaWebServer): WebApplication {
    return new class extends WebApplication {
      server = dep;
    }();
  }
}

@Suite()
export class AwsLambdaAuthWebTest extends AuthWebServerSuite {
  qualifier = ServerSymbol;
  type = AwsLambdaWebServerSupport;
}
