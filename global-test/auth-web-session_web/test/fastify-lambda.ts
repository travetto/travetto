import { AuthWebSessionServerSuite } from '@travetto/auth-web-session/support/test/server';
import { Suite } from '@travetto/test';
import { AwsLambdaFastifyWebServer } from '@travetto/web-fastify-lambda';
import { InjectableFactory } from '@travetto/di';
import { SessionModelSymbol } from '@travetto/auth-session';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server';
import { AwsLambdaWebApplication } from '@travetto/web-aws-lambda';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';

const FASTIFY = Symbol.for('fastify-lambda');

class Config {
  @InjectableFactory()
  static getServer(): AwsLambdaFastifyWebServer {
    return new AwsLambdaFastifyWebServer();
  }

  @InjectableFactory(FASTIFY)
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
  qualifier = FASTIFY;
  type = AwsLambdaWebServerSupport;
}
