import type koa from 'koa';

import { HttpRequest, HttpResponse, WebInternal, HttpResponseCore, HttpRequestCore } from '@travetto/web';
import { castTo } from '@travetto/runtime';

/**
 * Provides translation between koa request/response objects and the framework
 */
export class KoaWebServerUtil {
  /**
   * Convert context object from provider to framework
   */
  static convert(ctx: koa.Context): [HttpRequest, HttpResponse] {
    const fullCtx: typeof ctx & { [WebInternal]?: [HttpRequest, HttpResponse] } = ctx;
    return fullCtx[WebInternal] ??= [this.getRequest(ctx), this.getResponse(ctx)];
  }

  /**
   * Build a Travetto HttpRequest from a koa context
   */
  static getRequest(ctx: koa.Context): HttpRequest {
    return HttpRequestCore.create({
      [WebInternal]: {
        providerEntity: ctx,
        nodeEntity: ctx.req,
      },
      protocol: castTo(ctx.protocol),
      method: castTo(ctx.request.method),
      query: ctx.request.query,
      url: ctx.originalUrl,
      params: ctx.params,
      headers: ctx.request.headers,
      cookies: ctx.cookies,
      pipe: ctx.req.pipe.bind(ctx.req),
      on: ctx.req.on.bind(ctx.req)
    });
  }

  /**
   * Build a Travetto HttpResponse from a koa context
   */
  static getResponse(ctx: koa.Context): HttpResponse {
    return HttpResponseCore.create({
      [WebInternal]: {
        providerEntity: ctx,
        nodeEntity: ctx.res,
      },
      get headersSent(): boolean {
        return ctx.headerSent;
      },
      status(value?: number): number | undefined {
        if (value) {
          ctx.status = value;
        } else {
          return ctx.status;
        }
      },
      send: b => ctx.body = b,
      on: ctx.res.on.bind(ctx.res),
      end: ctx.response.flushHeaders.bind(ctx.response),
      vary: ctx.response.vary.bind(ctx.response),
      getHeaderNames: () => Object.keys(ctx.response.headers),
      setHeader: ctx.response.set.bind(ctx.response),
      getHeader: ctx.response.get.bind(ctx.response),
      removeHeader: ctx.response.remove.bind(ctx.response),
      write: ctx.res.write.bind(ctx.res),
    });
  }
}