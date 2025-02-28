import { AuthWebSessionServerSuite } from '@travetto/auth-web-session/support/test/server';
import { Suite } from '@travetto/test';
import { AwsLambdaExpressWebServer } from '@travetto/web-express-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server';
import { AwsLambdaWebApplication } from '@travetto/web-aws-lambda';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { SessionModelSymbol } from '@travetto/auth-session';

const EXPRESS = Symbol.for('express-lambda');

class Config {
  @InjectableFactory()
  static getServer(): AwsLambdaExpressWebServer {
    return new AwsLambdaExpressWebServer();
  }

  @InjectableFactory(EXPRESS)
  static getApp(dep: AwsLambdaExpressWebServer): AwsLambdaWebApplication {
    return new AwsLambdaWebApplication(dep);
  }

  @InjectableFactory({ primary: true, qualifier: SessionModelSymbol })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class ExpressLambdaWebSessionTest extends AuthWebSessionServerSuite {
  qualifier = EXPRESS;
  type = AwsLambdaWebServerSupport;
}
