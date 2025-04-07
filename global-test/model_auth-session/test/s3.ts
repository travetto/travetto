
import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { SessionModelSymbol } from '@travetto/auth-session';
import { S3ModelService, S3ModelConfig } from '@travetto/model-s3';
import { NodeWebApplication } from '@travetto/web-node';

import { AuthSessionServerSuite } from '@travetto/auth-session/support/test/server.ts';
import { ModelSuite } from '@travetto/model/support/test/suite.ts';
import { FetchWebDispatcher } from '@travetto/web-node/support/test/dispatcher.ts';

class Config {
  @InjectableFactory(SessionModelSymbol)
  static model(svc: S3ModelService) {
    return svc;
  }
}

@Suite()
@ModelSuite()
export class S3AuthSessionServerSuite extends AuthSessionServerSuite {
  timeScale = 10;
  serviceClass = S3ModelService;
  configClass = S3ModelConfig;
  dispatcherType = FetchWebDispatcher;
  appType = NodeWebApplication;
}
