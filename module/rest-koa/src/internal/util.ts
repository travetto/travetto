import * as koa from 'koa';
import { RestServerUtil } from '@travetto/rest';
import { TRV_ORIG, TRV_RAW } from '@travetto/rest/src/types';

const TRV_RES = Symbol.for('@trv:rest-koa/response');
const TRV_REQ = Symbol.for('@trv:rest-koa/request');

/**
 * Provides translation between koa request/response objects and the framework
 */
export class KoaServerUtil {
  /**
   * Build a Travetto Request from a koa context
   */
  static getRequest(ctx: koa.ParameterizedContext & { [TRV_REQ]?: Travetto.Request }) {
    if (!ctx[TRV_REQ]) {
      ctx[TRV_REQ] = RestServerUtil.decorateRequest({
        [TRV_ORIG]: ctx,
        [TRV_RAW]: ctx.req,
        protocol: ctx.protocol as 'http',
        method: ctx.request.method as 'GET',
        path: ctx.request.path,
        query: ctx.request.query,
        params: ctx.params,
        body: ctx.request.body,
        session: ctx.session,
        headers: ctx.request.headers,
        cookies: ctx.cookies,
        files: {},
        auth: undefined,
        pipe: ctx.req.pipe.bind(ctx.req),
        on: ctx.req.on.bind(ctx.req)
      });
    }
    return ctx[TRV_REQ]!;
  }

  /**
   * Build a Travetto Response from a koa context
   */
  static getResponse(ctx: koa.ParameterizedContext & { [TRV_RES]?: Travetto.Response }) {
    if (!ctx[TRV_RES]) {
      ctx[TRV_RES] = RestServerUtil.decorateResponse({
        [TRV_ORIG]: ctx,
        [TRV_RAW]: ctx.res,
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
        setHeader: ctx.response.set.bind(ctx.response),
        getHeader: ctx.response.get.bind(ctx.response),
        removeHeader: ctx.response.remove.bind(ctx.response),
        write: ctx.res.write.bind(ctx.res),
        cookies: ctx.cookies,
      });
    }
    return ctx[TRV_RES]!;
  }
}