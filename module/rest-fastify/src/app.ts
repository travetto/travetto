import { ServerResponse, IncomingMessage } from 'http';
import * as fastify from 'fastify';

import { ConfigLoader } from '@travetto/config';

import { ControllerConfig, RestAppProvider, Request, Response } from '@travetto/rest';
import { FastifyConfig } from './config';
import { MimeType } from '@travetto/rest/src';

export class FastifyAppProvider extends RestAppProvider {

  private app: fastify.FastifyInstance;
  private config: FastifyConfig;

  get _raw() {
    return this.app;
  }

  create(): any {
    const app = fastify();
    app.register(require('fastify-compress'));
    app.register(require('fastify-formbody'));
    app.register(require('fastify-cookie'));
    app.register(require('fastify-session'), this.config.session);
    app.addContentTypeParser('multipart/form-data;', (req: IncomingMessage, done: (err: Error | null, body?: any) => void) => {
      done(null);
    });

    // Enable proxy for cookies
    if (this.config.session.cookie.secure) {
      // app.enable('trust proxy');
    }

    return app;
  }

  async init() {
    this.config = new FastifyConfig();
    ConfigLoader.bindTo(this.config, 'rest.fastify');

    this.app = this.create();
  }

  async unregisterController(config: ControllerConfig) {
    console.log('Does not support real-time updating of routes');
  }

  getRequest(reqs: fastify.FastifyRequest<IncomingMessage>) {
    return {
      _raw: reqs,
      path: reqs.req.url!,
      query: reqs.query,
      params: reqs.params,
      body: (reqs as any).body,
      session: (reqs as any).session,
      headers: reqs.headers,
      cookies: (reqs as any).cookies,
      header(key: string) {
        return reqs.headers[key];
      },
      files: {},
      auth: undefined as any,
      pipe: reqs.req.pipe.bind(reqs.req),
      on: reqs.req.on.bind(reqs.req)
    } as Request;
  }

  getResponse(reply: fastify.FastifyReply<ServerResponse>) {
    return {
      _raw: reply,
      get statusCode() {
        return reply.res.statusCode;
      },
      get headersSent() {
        return reply.sent;
      },
      status: reply.status.bind(reply),
      send: reply.send.bind(reply),
      on: reply.res.on.bind(reply.res),
      end: reply.res.end.bind(reply.res, undefined),
      setHeader: reply.res.setHeader.bind(reply.res),
      getHeader: reply.res.getHeader.bind(reply.res),
      removeHeader: reply.res.removeHeader.bind(reply.res),
      write: reply.res.write.bind(reply.res),
      // tslint:disable-next-line:object-literal-shorthand
      json: function (val: any) {
        this.setHeader('Content-Type', MimeType.JSON);
        this.send(JSON.stringify(val));
      },
      cookie: (reply as any).setCookie.bind(reply)
    } as Response;
  }

  async registerController(cConfig: ControllerConfig) {
    for (const endpoint of cConfig.endpoints.reverse()) {
      let path: string = cConfig.basePath;
      if (typeof endpoint.path === 'string') {
        path = `${path}/${endpoint.path}`.replace(/\/+/g, '/');
      } else {
        path = `${path}/${endpoint.path.source}`.replace(/\/+/g, '/');
      }
      this.app[endpoint.method!](path, async (reqs, reply) => {
        const req = this.getRequest(reqs);
        const res = this.getResponse(reply);
        await endpoint.handlerFinalized!(req, res);
      });
    }

    console.debug('Registering Controller Instance', cConfig.class.__id, cConfig.basePath, cConfig.endpoints.length);
  }

  listen(port: number) {
    this.app.listen(port);
  }
}