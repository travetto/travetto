import { Suite } from '@travetto/test';
import { AwsLambdaFastifyRestServer } from '@travetto/rest-fastify-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaRestApplication } from '@travetto/rest-aws-lambda';

import { RestUploadServerSuite } from '@travetto/rest-upload/support/test/server.ts';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server.ts';

const FASTIFY = Symbol.for('fastify-lambda');

class Config {
  @InjectableFactory()
  static getServer(): AwsLambdaFastifyRestServer {
    return new AwsLambdaFastifyRestServer();
  }

  @InjectableFactory(FASTIFY)
  static getApp(dep: AwsLambdaFastifyRestServer): AwsLambdaRestApplication {
    return new AwsLambdaRestApplication(dep);
  }
}

@Suite()
export class FastifyLambdaRestUploadTest extends RestUploadServerSuite {
  qualifier = FASTIFY;
  type = AwsLambdaRestServerSupport;
}
