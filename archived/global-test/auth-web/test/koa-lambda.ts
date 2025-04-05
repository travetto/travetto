import { Suite } from '@travetto/test';
import { AwsLambdaKoaWebServer } from '@travetto/web-koa-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaWebApplication } from '@travetto/web-aws-lambda';

import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server.ts';
import { AuthWebServerSuite } from '@travetto/auth-web/support/test/server.ts';

const ServerSymbol = Symbol.for('koa-lambda');

class Config {
  @InjectableFactory()
  static getServer(): AwsLambdaKoaWebServer {
    return new AwsLambdaKoaWebServer();
  }

  @InjectableFactory(ServerSymbol)
  static getApp(dep: AwsLambdaKoaWebServer): AwsLambdaWebApplication {
    return new AwsLambdaWebApplication(dep);
  }
}

@Suite()
export class KoaLambdaAuthWebTest extends AuthWebServerSuite {
  qualifier = ServerSymbol;
  type = AwsLambdaWebServerSupport;
}
