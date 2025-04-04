import { Suite } from '@travetto/test';
import { AwsLambdaFastifyWebServer } from '@travetto/web-fastify-lambda';
import { InjectableFactory } from '@travetto/di';
import { SessionModelSymbol } from '@travetto/auth-session';
import { AwsLambdaWebApplication } from '@travetto/web-aws-lambda';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';

import { AuthWebSessionServerSuite } from '@travetto/auth-web-session/support/test/server.ts';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server.ts';

const ServerSymbol = Symbol.for('fastify-lambda');

class Config {
  @InjectableFactory()
  static getServer(): AwsLambdaFastifyWebServer {
    return new AwsLambdaFastifyWebServer();
  }

  @InjectableFactory(ServerSymbol)
  static getApp(dep: AwsLambdaFastifyWebServer): AwsLambdaWebApplication {
    return new AwsLambdaWebApplication(dep);
  }

  @InjectableFactory({ primary: true, qualifier: SessionModelSymbol })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class FastifyLambdaWebSessionTest extends AuthWebSessionServerSuite {
  qualifier = ServerSymbol;
  type = AwsLambdaWebServerSupport;
}
