import { FastifyInstance, fastify } from 'fastify';
import { fastifyCompress } from '@fastify/compress';
import { fastifyEtag } from '@fastify/etag';

import { WebConfig, WebServer, WebServerHandle, EndpointConfig, EtagConfig, CompressConfig, HTTP_METHODS } from '@travetto/web';
import { Inject, Injectable } from '@travetto/di';

import { FastifyWebServerUtil } from './util.ts';

/**
 * Fastify-based web server
 */
@Injectable()
export class FastifyWebServer implements WebServer<FastifyInstance> {

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
    if (this.compress.applies) {
      const preferred = this.compress.preferredEncodings ?? this.compress.supportedEncodings.filter(x => x !== 'deflate');
      app.register(fastifyCompress, { encodings: this.compress.supportedEncodings, requestEncodings: preferred });
      this.compress.applies = false;
    }

    // Defer to fastify if disabled
    if (this.etag.applies) {
      app.register(fastifyEtag, { weak: !!this.etag.weak, replyWith304: true });
      this.etag.applies = false;
    }

    app.removeAllContentTypeParsers();
    app.addContentTypeParser(/^.*/, (_, body, done) => done(null, body));

    return this.raw = app;
  }

  async registerEndpoints(endpoints: EndpointConfig[]): Promise<void> {
    for (const endpoint of endpoints) {
      let path = endpoint.fullPath;
      if (path === '/*all') {
        path = '*';
      }

      this.raw[HTTP_METHODS[endpoint.method].lower](path, (req, reply) =>
        endpoint.filter!({ req: FastifyWebServerUtil.getRequest(req, reply) })
      );
    }
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