import { Suite } from '@travetto/test';
import { AwsLambdaFastifyWebServer } from '@travetto/web-fastify-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaWebApplication } from '@travetto/web-aws-lambda';

import { AwsLambdaWebServerSupport } from '@travetto/web-aws-lambda/support/test/server.ts';

import { ModelBlobWebUploadServerSuite } from '../../../../global-test/model_web-upload/test/server.ts';

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
}

@Suite()
export class FastifyLambdaWebUploadTest extends ModelBlobWebUploadServerSuite {
  qualifier = ServerSymbol;
  type = AwsLambdaWebServerSupport;
}
