import { ServerResponse, IncomingMessage } from 'http';
import * as fastify from 'fastify';

import { ConfigLoader } from '@travetto/config';

import { ControllerConfig, RestAppProvider, RestInterceptor, Request, Response } from '@travetto/rest';
import { FastifyConfig } from './config';

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
    app.register(require('fastify-session'), this.config);
    app.addContentTypeParser('multipart/form-data;', (req: IncomingMessage, done: (err: Error | null, body?: any) => void) => {
      done(null);
    });

    // Enable proxy for cookies
    if (this.config.cookie.secure) {
      // app.enable('trust proxy');
    }

    return app;
  }

  async init() {
    this.config = new FastifyConfig();
    ConfigLoader.bindTo(this.config, 'express');

    this.app = this.create();
  }

  async unregisterController(config: ControllerConfig) {
    console.log('Does not support real-time updating of routes');
  }

  getRequest(reqs: fastify.FastifyRequest<IncomingMessage>) {
    return {
      ...reqs.req,
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
      pipe: reqs.req.pipe.bind(reqs.req),
      on: reqs.req.on.bind(reqs.req)
    } as Request;
  }

  getResponse(reply: fastify.FastifyReply<ServerResponse>) {
    return {
      ...reply.res,
      header: reply.header.bind(reply),
      get statusCode() {
        return reply.res.statusCode;
      },
      get headersSent() {
        return reply.sent;
      },
      send: reply.send.bind(reply),
      on: reply.res.on.bind(reply.res),
      end: reply.res.end.bind(reply.res, undefined),
      setHeader: reply.res.setHeader.bind(reply.res),
      getHeader: reply.res.getHeader.bind(reply.res),
      removeHeader: reply.res.removeHeader.bind(reply.res),
      write: reply.res.write.bind(reply.res),
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
      this.app[endpoint.method!](path, (reqs, reply) => {
        const req = this.getRequest(reqs);
        const res = this.getResponse(reply);
        endpoint.handlerFinalized!(req, res);
      });

    }

    console.debug('Registering Controller Instance', cConfig.class.__id, cConfig.basePath, cConfig.endpoints.length);
  }

  registerInterceptor(op: RestInterceptor) {
    this.app.use(op.intercept as any);
  }

  listen(port: number) {
    this.app.listen(port);
  }
}