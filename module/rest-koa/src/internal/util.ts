import { Readable } from 'stream';

import * as koa from 'koa';

import { RestServerUtil } from '@travetto/rest';
import { NodeEntityⲐ, ProviderEntityⲐ, SendStreamⲐ } from '@travetto/rest/src/internal/symbol';
import { StreamUtil } from '@travetto/boot';

/**
 * Provides translation between koa request/response objects and the framework
 */
export class KoaServerUtil {
  /**
   * Build a Travetto Request from a koa context
   */
  static getRequest(ctx: koa.ParameterizedContext<unknown>) {
    return RestServerUtil.decorateRequest({
      [ProviderEntityⲐ]: ctx,
      [NodeEntityⲐ]: ctx.req,
      protocol: ctx.protocol as 'http',
      method: ctx.request.method as 'GET',
      query: ctx.request.query,
      url: ctx.url,
      params: ctx.params,
      body: ctx.body,
      session: ctx.session,
      headers: ctx.request.headers,
      cookies: ctx.cookies,
      files: undefined,
      auth: undefined,
      pipe: ctx.req.pipe.bind(ctx.req),
      on: ctx.req.on.bind(ctx.req)
    });
  }

  /**
   * Build a Travetto Response from a koa context
   */
  static getResponse(ctx: koa.ParameterizedContext<unknown>) {
    return RestServerUtil.decorateResponse({
      [ProviderEntityⲐ]: ctx,
      [NodeEntityⲐ]: ctx.res,
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
      send: b => ctx.body = b,
      [SendStreamⲐ]: async (stream: Readable) => {
        ctx.respond = false;
        ctx.response.status = 200;
        await StreamUtil.pipe(stream, ctx.res);
      },
      on: ctx.res.on.bind(ctx.res),
      end: (val?: unknown) => {
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
    });
  }
}