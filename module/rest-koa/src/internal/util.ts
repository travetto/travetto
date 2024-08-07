import { pipeline } from 'node:stream/promises';

import type koa from 'koa';

import { RestServerUtil, Request, Response } from '@travetto/rest';
import { NodeEntityⲐ, ProviderEntityⲐ } from '@travetto/rest/src/internal/symbol';

/**
 * Provides translation between koa request/response objects and the framework
 */
export class KoaServerUtil {
  /**
   * Build a Travetto Request from a koa context
   */
  static getRequest(ctx: koa.Context): Request {
    return RestServerUtil.decorateRequest({
      [ProviderEntityⲐ]: ctx,
      [NodeEntityⲐ]: ctx.req,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      protocol: ctx.protocol as 'http',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      method: ctx.request.method as 'GET',
      query: ctx.request.query,
      url: ctx.originalUrl,
      params: ctx.params,
      session: ctx.session,
      headers: ctx.request.headers,
      cookies: ctx.cookies,
      pipe: ctx.req.pipe.bind(ctx.req),
      on: ctx.req.on.bind(ctx.req)
    });
  }

  /**
   * Build a Travetto Response from a koa context
   */
  static getResponse(ctx: koa.Context): Response {
    return RestServerUtil.decorateResponse({
      [ProviderEntityⲐ]: ctx,
      [NodeEntityⲐ]: ctx.res,
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
      end: (val?: unknown): void => {
        if (val) {
          ctx.body = val;
        }
        ctx.flushHeaders();
        if (ctx.status < 200 || (ctx.status < 400 && ctx.status >= 300)) {
          ctx.res.end(); // Only end on redirect
        }
      },
      setHeader: ctx.response.set.bind(ctx.response),
      getHeader: ctx.response.get.bind(ctx.response),
      removeHeader: ctx.response.remove.bind(ctx.response),
      write: ctx.res.write.bind(ctx.res),
      cookies: ctx.cookies,
      async sendStream(stream): Promise<void> {
        ctx.status = 200;
        ctx.respond = false;
        await pipeline(stream, ctx.res);
      },
    });
  }
}