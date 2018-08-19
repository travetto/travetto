import * as koa from 'koa';
import * as kCompress from 'koa-compress';
import * as kSession from 'koa-session';
import * as kBodyParser from 'koa-bodyparser';
import * as kRouter from 'koa-router';

import { ConfigLoader } from '@travetto/config';

import { ControllerConfig, RestAppProvider, Request, Response } from '@travetto/rest';
import { KoaConfig } from './config';
import { MimeType } from '@travetto/rest/src';

export class KoaAppProvider extends RestAppProvider {

  private app: koa;
  private config: KoaConfig;

  get _raw() {
    return this.app;
  }

  create(): any {
    const app = new koa();
    app.use(kCompress());
    app.use(kBodyParser());
    app.use(kSession(this.config.session, app));

    return app;
  }

  async init() {
    this.config = new KoaConfig();
    ConfigLoader.bindTo(this.config, 'rest.koa');

    this.app = this.create();
  }
  getRequest(ctx: koa.Context) {
    return {
      _raw: ctx,
      method: ctx.method,
      path: ctx.path,
      query: ctx.query,
      params: ctx.params,
      body: ctx.body,
      session: ctx.session,
      headers: ctx.headers,
      cookies: ctx.cookies,
      header: ctx.get.bind(ctx),
      files: {},
      auth: undefined as any,
      pipe: ctx.req.pipe.bind(ctx.req),
      on: ctx.req.on.bind(ctx.req)
    } as Request;
  }

  getResponse(ctx: koa.Context) {
    return {
      _raw: ctx,
      get statusCode() {
        return ctx.status;
      },
      get headersSent() {
        return ctx.headerSent;
      },
      status(value?: number) {
        if (value) {
          ctx.status = value;
        } else {
          return ctx.status;
        }
      },
      send: (b) => {
        ctx.body = b;
      },
      on: ctx.res.on.bind(ctx.res),
      end: ctx.flushHeaders.bind(ctx),
      setHeader: ctx.set.bind(ctx),
      getHeader: ctx.response.get.bind(ctx),
      removeHeader: ctx.remove.bind(ctx),
      write: ctx.res.write.bind(ctx.res),
      cookie: ctx.cookies.set.bind(ctx.cookies),
      // tslint:disable-next-line:object-literal-shorthand
      json: function (val: any) {
        this.setHeader('Content-Type', MimeType.JSON);
        this.send(JSON.stringify(val));
      },
    } as Response;
  }

  async unregisterController(config: ControllerConfig) {
    const loc = this.app.middleware.
      findIndex(x => ((x as any).key === config.class.__id));
    if (loc) {
      this.app.middleware.splice(loc, 1); // Router
    }
  }

  async registerController(cConfig: ControllerConfig) {
    const router = new kRouter({ prefix: cConfig.basePath });

    for (const endpoint of cConfig.endpoints.reverse()) {
      router[endpoint.method!](endpoint.path!, async (ctx) => {
        const req = this.getRequest(ctx);
        const res = this.getResponse(ctx);
        return await endpoint.handlerFinalized!(req, res);
      });
    }

    console.debug('Registering Controller Instance', cConfig.class.__id, cConfig.basePath, cConfig.endpoints.length);
    const middleware = router.routes();
    (middleware as any).key = cConfig.class.__id;
    this.app.use(middleware);
  }

  listen(port: number) {
    this.app.listen(port);
  }
}