import { Suite } from '@travetto/test';
import { ExpressRestServer } from '@travetto/rest-express';
import { InjectableFactory } from '@travetto/di';
import { RestApplication, RestServer } from '@travetto/rest';
import { AssetRestUploadServerSuite } from './server';

const EXPRESS = Symbol.for('express');

class Config {
  @InjectableFactory()
  static getServer(): RestServer {
    return new ExpressRestServer();
  }

  @InjectableFactory(EXPRESS)
  static getApp(dep: ExpressRestServer): RestApplication {
    return new class extends RestApplication {
      server = dep;
    }();
  }
}

@Suite()
export class ExpressRestUploadTest extends AssetRestUploadServerSuite {
  qualifier = EXPRESS;
}
