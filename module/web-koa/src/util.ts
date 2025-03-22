import type koa from 'koa';

import { HttpRequest, HttpResponse, WebInternal, HttpResponseCore, HttpRequestCore, HttpContext } from '@travetto/web';
import { castTo } from '@travetto/runtime';

/**
 * Provides translation between koa request/response objects and the framework
 */
export class KoaWebServerUtil {
  /**
   * Convert context object from provider to framework
   */
  static getContext(ctx: koa.Context): HttpContext {
    const fullCtx: typeof ctx & { [WebInternal]?: HttpContext } = ctx;
    return fullCtx[WebInternal] ??= {
      req: this.getRequest(ctx),
      res: this.getResponse(ctx),
      next(): void { },
      config: {}
    };
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
    });
  }

  /**
   * Build a Travetto HttpResponse from a koa context
   */
  static getResponse(ctx: koa.Context): HttpResponse {
    return HttpResponseCore.create({
      [WebInternal]: {
        providerEntity: ctx,
        nodeEntity: ctx.res
      },
      get headersSent(): boolean {
        return ctx.headerSent;
      },
      get statusCode(): number {
        return ctx.status;
      },
      set statusCode(code: number) {
        ctx.status = code;
      },
      respond(value) {
        ctx.body = value;
        ctx.response.flushHeaders();
      },
      vary: ctx.response.vary.bind(ctx.response),
      getHeaderNames: () => Object.keys(ctx.response.headers),
      setHeader: ctx.response.set.bind(ctx.response),
      getHeader: ctx.response.get.bind(ctx.response),
      removeHeader: ctx.response.remove.bind(ctx.response),
    });
  }
}