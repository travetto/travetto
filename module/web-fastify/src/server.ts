import { FastifyInstance, fastify } from 'fastify';

import { WebConfig, WebServer, WebServerHandle, WebRouter } from '@travetto/web';
import { Inject, Injectable } from '@travetto/di';
import { castTo } from '@travetto/runtime';

import { FastifyWebServerUtil } from './util.ts';

/**
 * Fastify-based web server
 */
@Injectable()
export class FastifyWebServer implements WebServer<FastifyInstance> {

  raw: FastifyInstance;

  @Inject()
  config: WebConfig;

  /**
   * Build the fastify server
   */
  async init(): Promise<FastifyInstance> {
    const app = fastify({
      trustProxy: this.config.trustProxy,
      ...this.config.ssl?.active ? {
        https: (await this.config.ssl?.getKeys()),
      } : {}
    });

    app.removeAllContentTypeParsers();
    app.addContentTypeParser(/^.*/, (_, body, done) => done(null, body));

    return this.raw = app;
  }

  registerRouter(router: WebRouter): void {
    this.raw.addHook('onRequest', (req, reply) => {
      const { endpoint, params } = router({ method: castTo((req.method).toUpperCase()), url: req.url, headers: req.headers });
      return endpoint.filter!({ req: FastifyWebServerUtil.getRequest(req, reply, params) });
    });
  }

  async listen(): Promise<WebServerHandle> {
    await this.raw.listen({ port: this.config.port, host: this.config.bindAddress });

    return {
      port: this.config.port,
      on: this.raw.server.on.bind(this.raw),
      close: this.raw.close.bind(this.raw)
    };
  }
}