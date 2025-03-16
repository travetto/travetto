import { type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type koa from 'koa';

import { HttpRequest, HttpResponse, WebSymbols, HttpResponseCore, HttpRequestCore } from '@travetto/web';
import { castTo, hasFunction } from '@travetto/runtime';

const isReadable = hasFunction<Readable>('pipe');

/**
 * Provides translation between koa request/response objects and the framework
 */
export class KoaWebServerUtil {
  /**
   * Convert context object from provider to framework
   */
  static convert(ctx: koa.Context): [HttpRequest, HttpResponse] {
    const fullCtx: typeof ctx & { [WebSymbols.Internal]?: [HttpRequest, HttpResponse] } = ctx;
    return fullCtx[WebSymbols.Internal] ??= [this.getRequest(ctx), this.getResponse(ctx)];
  }

  /**
   * Build a Travetto HttpRequest from a koa context
   */
  static getRequest(ctx: koa.Context): HttpRequest {
    return HttpRequestCore.create({
      [WebSymbols.Internal]: {
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
      [WebSymbols.Internal]: {
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
      end(this: HttpResponse, val?: unknown): void {
        if (val) {
          ctx.body = val;
        }
        if (ctx.headerSent) {
          ctx.res.end(); // End if headers already sent
        } else if (isReadable(ctx.body)) {
          pipeline(ctx.body, ctx.res, { end: false }).then(ctx.res.end.bind(ctx.res));
          return;
        } else {
          ctx.body ??= '';
          ctx.flushHeaders();
        }
      },
      vary: ctx.response.vary.bind(ctx.response),
      getHeaderNames: () => Object.keys(ctx.response.headers),
      setHeader: ctx.response.set.bind(ctx.response),
      getHeader: ctx.response.get.bind(ctx.response),
      removeHeader: ctx.response.remove.bind(ctx.response),
      write: ctx.res.write.bind(ctx.res),
    });
  }
}