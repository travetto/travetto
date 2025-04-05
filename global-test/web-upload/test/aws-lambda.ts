import { Suite } from '@travetto/test';
import { AwsLambdaWebServer } from '@travetto/web-aws-lambda';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';

import { WebUploadServerSuite } from '@travetto/web-upload/support/test/server.ts';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server-support.ts';

const ServerSymbol = Symbol.for('aws-lambda');

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
export class AwsLambdaWebUploadTest extends WebUploadServerSuite {
  qualifier = ServerSymbol;
  type = AwsLambdaWebServerSupport;
}
