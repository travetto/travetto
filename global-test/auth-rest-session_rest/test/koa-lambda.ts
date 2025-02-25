import { AuthRestSessionServerSuite } from '@travetto/auth-rest-session/support/test/server';
import { Suite } from '@travetto/test';
import { AwsLambdaKoaRestServer } from '@travetto/rest-koa-lambda';
import { InjectableFactory } from '@travetto/di';
import { AwsLambdaRestServerSupport } from '@travetto/rest-aws-lambda/support/test/server';
import { AwsLambdaRestApplication } from '@travetto/rest-aws-lambda';
import { MemoryModelConfig, MemoryModelService } from '@travetto/model-memory';
import { SessionModelSymbol } from '@travetto/auth-session';

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

  @InjectableFactory({ primary: true, qualifier: SessionModelSymbol })
  static provider() {
    return new MemoryModelService(new MemoryModelConfig());
  }
}

@Suite()
export class KoaLambdaRestSessionTest extends AuthRestSessionServerSuite {
  qualifier = KOA;
  type = AwsLambdaRestServerSupport;
}
