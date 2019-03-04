import * as koa from 'koa';
import * as kCompress from 'koa-compress';
import * as kBodyParser from 'koa-bodyparser';
import * as kRouter from 'koa-router';

import { ConfigLoader } from '@travetto/config';
import { RestConfig, ControllerConfig, RestApp, ProviderUtil } from '@travetto/rest';

import { KoaConfig } from './config';

const TRV_KEY = Symbol('TRV_KEY');

export class KoaRestApp extends RestApp {

  private app: koa;
  private config: KoaConfig;

  get raw() {
    return this.app;
  }

  create(): any {
    const app = new koa();
    app.use(kCompress());
    app.use(kBodyParser());

    return app;
  }

  async init() {
    this.config = new KoaConfig();
    ConfigLoader.bindTo(this.config, 'rest.koa');

    this.app = this.create();

    this.app.use(async (ctx, next) => {
      const req = this.getRequest(ctx);
      const res = this.getResponse(ctx);

      await this.executeInterceptors(req, res);
      await next();
    });
  }

  getRequest(ctx: koa.ParameterizedContext) {
    if (!(ctx as any)[TRV_KEY]) {
      (ctx as any)[TRV_KEY] = ProviderUtil.decorateRequest({
        __raw: ctx,
        method: ctx.method,
        path: ctx.path,
        query: ctx.query,
        params: ctx.params,
        body: ctx.body,
        session: ctx.session,
        headers: ctx.headers,
        cookies: ctx.cookies,
        files: {},
        auth: undefined as any,
        pipe: ctx.req.pipe.bind(ctx.req),
        on: ctx.req.on.bind(ctx.req)
      });
    }
    return (ctx as any)[TRV_KEY] as Travetto.Request;
  }

  getResponse(ctx: koa.ParameterizedContext) {
    if (!(ctx as any)[TRV_KEY]) {
      (ctx as any)[TRV_KEY] = ProviderUtil.decorateResponse({
        __raw: ctx,
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
        end: (val?: any) => {
          if (val) {
            ctx.body = val;
          }
          ctx.flushHeaders();
          if (ctx.status < 200 || (ctx.status < 400 && ctx.status >= 300)) {
            ctx.res.end(); // Only end on redirect
          }
        },
        setHeader: ctx.set.bind(ctx),
        getHeader: ctx.response.get.bind(ctx),
        removeHeader: ctx.remove.bind(ctx),
        write: ctx.res.write.bind(ctx.res),
        cookie: ctx.cookies.set.bind(ctx.cookies),
      });
    }
    return (ctx as any)[TRV_KEY] as Travetto.Response;
  }

  async unregisterController(config: ControllerConfig) {
    const loc = this.app.middleware.
      findIndex(x => ((x as any).key === config.class.__id));
    if (loc) {
      this.app.middleware.splice(loc, 1); // Router
    }
  }

  async registerController(cConfig: ControllerConfig) {
    const router = new kRouter(cConfig.basePath !== '/' ? { prefix: cConfig.basePath } : {});

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

  async listen(config: RestConfig) {
    if (config.ssl) {
      const https = await import('https');
      https.createServer(await config.getKeys(), this.app.callback()).listen(config.port);
    } else {
      this.app.listen(config.port);
    }
  }
}