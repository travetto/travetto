import { AuthWebServerSuite } from '@travetto/auth-web/support/test/server';
import { Suite } from '@travetto/test';
import { AwsLambdaKoaWebServer } from '@travetto/web-koa-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server';
import { AwsLambdaWebApplication } from '@travetto/web-aws-lambda';

const KOA = Symbol.for('koa-lambda');

class Config {
  @InjectableFactory()
  static getServer(): AwsLambdaKoaWebServer {
    return new AwsLambdaKoaWebServer();
  }

  @InjectableFactory(KOA)
  static getApp(dep: AwsLambdaKoaWebServer): AwsLambdaWebApplication {
    return new AwsLambdaWebApplication(dep);
  }
}

@Suite()
export class KoaLambdaAuthWebTest extends AuthWebServerSuite {
  qualifier = KOA;
  type = AwsLambdaWebServerSupport;
}
