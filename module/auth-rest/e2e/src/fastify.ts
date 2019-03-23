import * as fastify from 'fastify';

import { InjectableFactory } from '@travetto/di';
import { Application, RestApp, RestAppCustomizer } from '@travetto/rest';
import { FastifyRestApp } from '@travetto/rest-fastify';

@Application('sample:fastify')
export class SampleApp {

  @InjectableFactory()
  static customizer(): RestAppCustomizer<fastify.FastifyInstance> {
    return new (class extends RestAppCustomizer<fastify.FastifyInstance> {
      customize(raw: fastify.FastifyInstance) {
        // raw.register(fastifySession, {
        //   secret: 'fastify-fastify-fastify-fastify-fastify-',
        //   cookie: {
        //     secure: false
        //   }
        // });
      }
    })();
  }

  constructor(private app: FastifyRestApp) { }

  run() {
    this.app.run();
  }
}