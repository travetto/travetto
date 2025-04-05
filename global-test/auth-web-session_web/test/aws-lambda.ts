import { Suite } from '@travetto/test';
import { AwsLambdaWebServer } from '@travetto/web-aws-lambda';
import { SessionModelSymbol } from '@travetto/auth-session';
import { InjectableFactory } from '@travetto/di';
import { WebApplication } from '@travetto/web';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';

import { AuthWebSessionServerSuite } from '@travetto/auth-web-session/support/test/server.ts';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server-support.ts';

const ServerSymbol = Symbol.for('aws-lambda');

class Config {
  @InjectableFactory(ServerSymbol)
  static getApp(dep: AwsLambdaWebServer): WebApplication {
    return new class extends WebApplication {
      server = dep;
    }();
  }

  @InjectableFactory({ primary: true, qualifier: SessionModelSymbol })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class AwsLambdaWebSessionTest extends AuthWebSessionServerSuite {
  qualifier = ServerSymbol;
  type = AwsLambdaWebServerSupport;
}
