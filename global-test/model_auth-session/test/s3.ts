import { SessionModelSymbol } from '@travetto/auth-session';
import { InjectableFactory } from '@travetto/di';
import { S3ModelConfig, S3ModelService } from '@travetto/model-s3';
import { Suite } from '@travetto/test';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';

class Config {
  @InjectableFactory(SessionModelSymbol)
  static model(svc: S3ModelService) {
    return svc;
  }
}

@Suite()
class S3AuthSessionServerSuite extends AuthSessionServerSuite<S3ModelService> {
  timeScale = 10;
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
}
