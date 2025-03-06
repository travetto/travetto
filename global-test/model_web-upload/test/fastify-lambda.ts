import { Suite } from '@travetto/test';
import { AwsLambdaFastifyWebServer } from '@travetto/web-fastify-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaWebApplication } from '@travetto/web-aws-lambda';

import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server';

import { ModelBlobWebUploadServerSuite } from './server';

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
export class FastifyLambdaWebUploadTest extends ModelBlobWebUploadServerSuite {
  qualifier = FASTIFY;
  type = AwsLambdaWebServerSupport;
}
