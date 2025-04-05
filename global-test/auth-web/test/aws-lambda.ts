import { Suite } from '@travetto/test';
import { AwsLambdaWebServer } from '@travetto/web-aws-lambda';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';

import { AuthWebServerSuite } from '@travetto/auth-web/support/test/server.ts';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server-support';

const ServerSymbol = Symbol.for('node');

class Config {
  @InjectableFactory()
  static getServer(): WebServer {
    return new AwsLambdaWebServer();
  }

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
