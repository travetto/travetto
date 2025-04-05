import { Suite } from '@travetto/test';
import { AwsLambdaWebServer } from '@travetto/web-aws-lambda';
import { InjectableFactory } from '@travetto/di';
import { WebApplication, WebServer } from '@travetto/web';

import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server-support.ts';

import { ModelBlobWebUploadServerSuite } from './server.ts';

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
export class AwsLambdaWebUploadTest extends ModelBlobWebUploadServerSuite {
  qualifier = ServerSymbol;
  type = AwsLambdaWebServerSupport;
}
