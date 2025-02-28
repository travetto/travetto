import { WebUploadServerSuite } from '@travetto/web-upload/support/test/server';
import { Suite } from '@travetto/test';
import { AwsLambdaFastifyWebServer } from '@travetto/web-fastify-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server';
import { AwsLambdaWebApplication } from '@travetto/web-aws-lambda';

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
}

@Suite()
export class FastifyLambdaWebUploadTest extends WebUploadServerSuite {
  qualifier = FASTIFY;
  type = AwsLambdaWebServerSupport;
}
