import { Suite } from '@travetto/test';
import { AwsLambdaKoaRestServer } from '@travetto/rest-koa-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaRestApplication } from '@travetto/rest-aws-lambda';

import { RestUploadServerSuite } from '@travetto/rest-upload/support/test/server.ts';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server.ts';

const KOA = Symbol.for('koa-lambda');

class Config {
  @InjectableFactory()
  static getServer(): AwsLambdaKoaRestServer {
    return new AwsLambdaKoaRestServer();
  }

  @InjectableFactory(KOA)
  static getApp(dep: AwsLambdaKoaRestServer): AwsLambdaRestApplication {
    return new AwsLambdaRestApplication(dep);
  }
}

@Suite()
export class KoaLambdaRestUploadTest extends RestUploadServerSuite {
  qualifier = KOA;
  type = AwsLambdaRestServerSupport;
}
