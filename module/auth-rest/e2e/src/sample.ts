import * as koa from 'koa';
import * as koaSession from 'koa-session';

import { InjectableFactory } from '@travetto/di';
import { Application, RestApp, RestAppCustomizer } from '@travetto/rest';
import { KoaRestApp } from '@travetto/rest-koa';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static customizer(): RestAppCustomizer<koa> {
    return new (class extends RestAppCustomizer<koa> {
      customize(raw: koa) {
        raw.use(koaSession({
          key: 'koa:sess',
          maxAge: 86400000,
          autoCommit: true,
          overwrite: true,
          httpOnly: true,
          signed: true,
          rolling: false,
          renew: false,
        } as any, raw));
        raw.keys = ['this is a super special key'];
      }
    })();
  }

  @InjectableFactory()
  static getProvider(): RestApp {
    return new KoaRestApp();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}