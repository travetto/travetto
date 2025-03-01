import { Suite } from '@travetto/test';
import { AwsLambdaKoaWebServer } from '@travetto/web-koa-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaWebApplication } from '@travetto/web-aws-lambda';

import { WebUploadServerSuite } from '@travetto/web-upload/support/test/server';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server';

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
export class KoaLambdaWebUploadTest extends WebUploadServerSuite {
  qualifier = KOA;
  type = AwsLambdaWebServerSupport;
}
