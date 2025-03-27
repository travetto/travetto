import type koa from 'koa';

import { HttpRequest, WebInternal, HttpRequestCore, HttpChainedContext } from '@travetto/web';
import { castTo } from '@travetto/runtime';

/**
 * Provides translation between koa request/response objects and the framework
 */
export class KoaWebServerUtil {
  /**
   * Convert context object from provider to framework
   */
  static getContext(ctx: koa.Context): HttpChainedContext {
    const fullCtx: typeof ctx & { [WebInternal]?: HttpChainedContext } = ctx;
    return fullCtx[WebInternal] ??= {
      req: this.getRequest(ctx),
      next: async () => null!,
      config: {}
    };
  }

  /**
   * Build a Travetto HttpRequest from a koa context
   */
  static getRequest(ctx: koa.Context): HttpRequest {
    return HttpRequestCore.create({
      protocol: castTo(ctx.protocol),
      method: castTo(ctx.request.method),
      query: ctx.request.query,
      url: ctx.originalUrl,
      params: ctx.params,
      headers: ctx.request.headers,
      pipe: ctx.req.pipe.bind(ctx.req),
    }, {
      providerReq: ctx,
      providerRes: ctx,
      inputStream: ctx.req,
      respond(value) {
        ctx.response.status = value.statusCode ?? 200;
        ctx.res.setHeaders(new Map(Object.entries(value.headers.toObject())));
        return ctx.response.body = value.output;
      }
    });
  }
}