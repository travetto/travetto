import { Suite } from '@travetto/test';
import { AwsLambdaKoaWebServer } from '@travetto/web-koa-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaWebApplication } from '@travetto/web-aws-lambda';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { SessionModelSymbol } from '@travetto/auth-session';

import { AuthWebSessionServerSuite } from '@travetto/auth-web-session/support/test/server.ts';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server.ts';

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

  @InjectableFactory({ primary: true, qualifier: SessionModelSymbol })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class KoaLambdaWebSessionTest extends AuthWebSessionServerSuite {
  qualifier = ServerSymbol;
  type = AwsLambdaWebServerSupport;
}
