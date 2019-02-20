import { ServerResponse, IncomingMessage } from 'http';
import * as fastify from 'fastify';

import { ConfigLoader } from '@travetto/config';
import { RestConfig, ControllerConfig, RestAppProvider, ProviderUtil } from '@travetto/rest';

import { FastifyConfig } from './config';

export class RestFastifyAppProvider extends RestAppProvider {

  private app: fastify.FastifyInstance;
  private config: FastifyConfig;

  get _raw() {
    return this.app;
  }

  async create(restConfig: RestConfig) {
    const fastConf: any = {};
    if (restConfig.ssl) {
      fastConf.https = await restConfig.getKeys();
    }

    const app = fastify(fastConf);
    app.register(require('fastify-compress'));
    app.register(require('fastify-formbody'));
    app.register(require('fastify-cookie'));
    app.addContentTypeParser('multipart/form-data;', (req: IncomingMessage, done: (err: Error | null, body?: any) => void) => {
      done(null);
    });

    // Enable proxy for cookies
    if (this.config.session.cookie.secure) {
      // app.enable('trust proxy');
    }

    return app;
  }

  async init(restConfig: RestConfig) {
    this.config = new FastifyConfig();
    ConfigLoader.bindTo(this.config, 'rest.fastify');

    this.app = await this.create(restConfig);

    this.app.addHook('preHandler', (reqs, reply) => {
      const req = this.getRequest(reqs);
      const res = this.getResponse(reply);
      return this.executeInterceptors(req, res);
    });
  }

  async unregisterController(config: ControllerConfig) {
    console.info('Does not support real-time updating of routes');
  }

  getRequest(reqs: fastify.FastifyRequest<IncomingMessage>) {
    if (!(reqs as any)._trvReq) {
      (reqs as any)._trvReq = ProviderUtil.decorateRequest({
        _raw: reqs,
        method: reqs.req.method,
        path: reqs.req.url!,
        query: reqs.query,
        params: reqs.params,
        body: (reqs as any).body,
        session: (reqs as any).session,
        headers: reqs.headers,
        cookies: (reqs as any).cookies,
        files: {},
        auth: undefined as any,
        pipe: reqs.req.pipe.bind(reqs.req),
        on: reqs.req.on.bind(reqs.req)
      });
    }
    return (reqs as any)._trvReq;
  }

  getResponse(reply: fastify.FastifyReply<ServerResponse>) {
    if (!(reply as any)._trvRes) {
      (reply as any)._trvRes = ProviderUtil.decorateResponse({
        _raw: reply,
        get headersSent() {
          return reply.sent;
        },
        status(val?: number): number | undefined {
          if (val) {
            reply.status(val);
            reply.res.statusCode = val;
          } else {
            return reply.res.statusCode;
          }
        },
        send: reply.send.bind(reply),
        on: reply.res.on.bind(reply.res),
        end: (val?: any) => {
          if (val) {
            reply.send(val);
          }
          reply.res.end();
        },
        setHeader: reply.res.setHeader.bind(reply.res),
        getHeader: reply.res.getHeader.bind(reply.res) as (key: string) => string, // NOTE: Forcing type, may be incorrect
        removeHeader: reply.res.removeHeader.bind(reply.res),
        write: reply.res.write.bind(reply.res),
        cookie: (reply as any).setCookie.bind(reply)
      });
    }

    return (reply as any)._trvRes;
  }

  async registerController(cConfig: ControllerConfig) {
    for (const endpoint of cConfig.endpoints.reverse()) {
      let path: string = cConfig.basePath;
      if (typeof endpoint.path === 'string') {
        path = `${path}/${endpoint.path}`;
      } else {
        path = `${path}/${endpoint.path.source}`;
      }
      path = path.replace(/\/+/g, '/').replace(/\/+$/, '');
      this.app[endpoint.method!](path, async (reqs, reply) => {
        const req = this.getRequest(reqs);
        const res = this.getResponse(reply);
        await endpoint.handlerFinalized!(req, res);
      });
    }

    console.debug('Registering Controller Instance', cConfig.class.__id, cConfig.basePath, cConfig.endpoints.length);
  }

  listen(config: RestConfig) {
    this.app.listen(config.port);
  }
}