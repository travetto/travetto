// @file-if @travetto/rest-session
// @file-if @travetto/rest-express

import { InjectableFactory } from '@travetto/di';
import { Suite } from '@travetto/test';
import { RestSessionServerSuite } from '@travetto/rest-session/test-support/server';
import { SessionModelSym, ModelSessionProvider } from '@travetto/rest-session';

import { S3ModelService } from '../src/service';

class Config {
  @InjectableFactory(SessionModelSym)
  static model(svc: S3ModelService) {
    return svc;
  }

  @InjectableFactory({ primary: true })
  static provider() {
    return new ModelSessionProvider();
  }
}

@Suite()
export class S3RestSesisonServerSuite extends RestSessionServerSuite { }