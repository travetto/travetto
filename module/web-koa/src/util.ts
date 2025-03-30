import type koa from 'koa';

import { HttpRequest } from '@travetto/web';
import { castTo } from '@travetto/runtime';

/**
 * Provides translation between koa request/response objects and the framework
 */
export class KoaWebServerUtil {
  /**
   * Build a Travetto HttpRequest from a koa context
   */
  static getRequest(ctx: koa.Context): HttpRequest {
    return new HttpRequest({
      protocol: castTo(ctx.protocol),
      method: ctx.request.method,
      query: ctx.request.query,
      params: ctx.params,
      headers: ctx.request.headers,
      path: ctx.path,
      body: ctx.body,
      inputStream: ctx.req,
      remoteIp: ctx.req.socket.remoteAddress,
      port: ctx.req.socket.localPort,
      respond(value): unknown {
        ctx.response.status = value.statusCode ?? 200;
        value.headers.forEach((v, k) => ctx.res.setHeader(k, v));
        return ctx.response.body = value.output;
      }
    });
  }
}