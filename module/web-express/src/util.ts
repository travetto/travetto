import { type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type express from 'express';

import { WebSymbols, HttpRequest, HttpResponse, HttpRequestCore, HttpResponseCore } from '@travetto/web';
import { castTo, hasFunction } from '@travetto/runtime';

const isReadable = hasFunction<Readable>('pipe');

/**
 * Provide a mapping between express request/response and the framework analogs
 */
export class ExpressWebServerUtil {

  /**
   * Convert request, response object from provider to framework
   */
  static convert(req: express.Request, res: express.Response): [HttpRequest, HttpResponse] {
    const fullReq: typeof req & { [WebSymbols.Internal]?: HttpRequest } = req;
    const fullRes: typeof res & { [WebSymbols.Internal]?: HttpResponse } = res;
    const finalReq = fullReq[WebSymbols.Internal] ??= this.getRequest(req);
    const finalRes = fullRes[WebSymbols.Internal] ??= this.getResponse(res);
    return [finalReq, finalRes];
  }

  /**
   * Build a Travetto HttpRequest from an Express Request
   */
  static getRequest(req: express.Request): HttpRequest {
    return HttpRequestCore.create({
      [WebSymbols.Internal]: {
        providerEntity: req,
        nodeEntity: req,
      },
      protocol: castTo(req.protocol),
      method: castTo(req.method),
      url: req.originalUrl,
      query: req.query,
      params: req.params,
      headers: req.headers,
      pipe: req.pipe.bind(req),
      on: req.on.bind(req)
    });
  }

  /**
   * Build a Travetto HttpResponse from an Express Response
   */
  static getResponse(res: express.Response): HttpResponse {
    return HttpResponseCore.create({
      [WebSymbols.Internal]: {
        providerEntity: res,
        nodeEntity: res,
        cleanup: (_: HttpRequest, final: HttpResponse) => {
          const { body } = final[WebSymbols.Internal];
          if (isReadable(body)) {
            return pipeline(body, res);
          } else {
            res.send(body);
            res.end();
          }
        }
      },
      get headersSent(): boolean {
        return res.headersSent;
      },
      status(val?: number): number | undefined {
        if (val) {
          res.status(val);
          res.statusCode = val;
        } else {
          return res.statusCode;
        }
      },
      send(this: HttpResponse, data): void {
        this[WebSymbols.Internal].body = castTo<Buffer>(data);
      },
      on: res.on.bind(res),
      end: res.end.bind(res),
      vary: res.vary.bind(res),
      getHeaderNames: res.getHeaderNames.bind(res),
      setHeader: res.setHeader.bind(res),
      getHeader: castTo(res.getHeader.bind(res)), // NOTE: Forcing type, may be incorrect
      removeHeader: res.removeHeader.bind(res),
      write: res.write.bind(res)
    });
  }
}