import https from 'node:https';
import { FastifyInstance, fastify, FastifyHttpsOptions } from 'fastify';

import { WebConfig, WebServer, WebServerHandle, EndpointConfig } from '@travetto/web';
import { Inject, Injectable } from '@travetto/di';

import { FastifyWebServerUtil } from './util.ts';

/**
 * Fastify-based web server
 */
@Injectable()
export class FastifyWebServer implements WebServer<FastifyInstance> {

  listening = false;

  raw: FastifyInstance;

  @Inject()
  config: WebConfig;

  /**
   * Build the fastify server
   */
  async init(): Promise<FastifyInstance> {
    const fastConf: Partial<FastifyHttpsOptions<https.Server>> = {};

    if (this.config.ssl?.active) {
      fastConf.https = (await this.config.ssl?.getKeys())!;
    }
    if (this.config.trustProxy) {
      fastConf.trustProxy = true;
    }

    const app = fastify(fastConf);
    app.removeAllContentTypeParsers();
    app.addContentTypeParser(/^.*/, (_, body, done) => done(null, body));

    this.raw = app;
    return this.raw;
  }

  async unregisterEndpoints(key: string | symbol): Promise<void> {
    console.debug('Fastify does not allow for endpoint reloading');
  }

  async registerEndpoints(key: string | symbol, path: string, endpoints: EndpointConfig[]): Promise<void> {
    if (this.listening) { // Does not support live reload
      return;
    }
    for (const endpoint of endpoints) {
      let sub = path;
      if (endpoint.path) {
        sub = `${path}/${endpoint.path}`;
      }
      sub = sub.replace(/\/{1,3}/g, '/').replace(/\/{1,3}$/, '');
      this.raw[endpoint.method](sub, async (req, reply) => {
        await endpoint.handlerFinalized!(...FastifyWebServerUtil.convert(req, reply));
      });
    }
  }

  async listen(): Promise<WebServerHandle> {
    await this.raw.listen({ port: this.config.port, host: this.config.bindAddress });
    this.listening = true;
    return {
      on: this.raw.server.on.bind(this.raw),
      close: this.raw.close.bind(this.raw)
    };
  }
}