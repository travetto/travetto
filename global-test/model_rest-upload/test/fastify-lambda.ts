import { Suite } from '@travetto/test';
import { AwsLambdaFastifyRestServer } from '@travetto/rest-fastify-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaRestApplication } from '@travetto/rest-aws-lambda';

import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server';

import { ModelBlobRestUploadServerSuite } from './server';

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
export class FastifyLambdaRestUploadTest extends ModelBlobRestUploadServerSuite {
  qualifier = FASTIFY;
  type = AwsLambdaRestServerSupport;
}
