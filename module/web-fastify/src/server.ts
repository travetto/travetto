import { FastifyInstance, fastify } from 'fastify';
import { fastifyCompress } from '@fastify/compress';
import { fastifyEtag } from '@fastify/etag';

import { WebConfig, WebServer, WebServerHandle, EndpointConfig, EtagConfig, CompressConfig } from '@travetto/web';
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

  @Inject()
  etag: EtagConfig;

  @Inject()
  compress: CompressConfig;

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

    // Defer to fastify if disabled
    if (this.compress.disabled) {
      const preferred = this.compress.preferredEncodings ?? this.compress.supportedEncodings.filter(x => x !== 'deflate');
      app.register(fastifyCompress, { encodings: this.compress.supportedEncodings, requestEncodings: preferred });
    }

    // Defer to fastify if disabled
    if (this.etag.disabled) {
      app.register(fastifyEtag, { weak: !!this.etag.weak, replyWith304: true });
    }

    app.removeAllContentTypeParsers();
    app.addContentTypeParser(/^.*/, (_, body, done) => done(null, body));

    return this.raw = app;
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

      sub = sub.replace(/[/]{1,3}/g, '/').replace(/[/]{1,3}$/, '').replace(/^$/, '/');

      if (sub === '/*all') {
        sub = '*';
      }

      console.error('Registering', sub, `${path}/${endpoint.path}`, endpoint.class.name);
      this.raw[endpoint.method](sub, async (req, reply) => {
        await endpoint.filter!(FastifyWebServerUtil.getContext(req, reply));
        return reply;
      });
    }
  }

  async listen(): Promise<WebServerHandle> {
    await this.raw.listen({ port: this.config.port, host: this.config.bindAddress });
    this.listening = true;
    return {
      port: this.config.port,
      on: this.raw.server.on.bind(this.raw),
      close: this.raw.close.bind(this.raw)
    };
  }
}