import * as fastify from 'fastify';
const fastifySession = require('fastify-session');

import { InjectableFactory } from '@travetto/di';
import { Application, RestApp, RestAppCustomizer } from '@travetto/rest';
import { FastifyRestApp } from '@travetto/rest-fastify';

@Application('sample:fastify')
export class SampleApp {

  @InjectableFactory()
  static customizer(): RestAppCustomizer<fastify.FastifyInstance> {
    return new (class extends RestAppCustomizer<fastify.FastifyInstance> {
      customize(raw: fastify.FastifyInstance) {
        raw.register(fastifySession, {
          secret: 'fastify-fastify-fastify-fastify-fastify-',
          cookie: {
            secure: false
          }
        });
      }
    })();
  }

  @InjectableFactory()
  static getProvider(): RestApp {
    return new FastifyRestApp();
  }

  constructor(private app: RestApp) { }

  run() {
    this.app.run();
  }
}