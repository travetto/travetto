import type express from 'express';

import { WebSymbols, HttpRequest, HttpResponse, HttpRequestCore, HttpResponseCore } from '@travetto/web';
import { castTo } from '@travetto/runtime';

/**
 * Provide a mapping between express request/response and the framework analogs
 */
export class ExpressWebServerUtil {
  /**
   * Build a Travetto HttpRequest from an Express Request
   */
  static getRequest(req: express.Request): HttpRequest {
    return HttpRequestCore.create({
      [WebSymbols.ProviderEntity]: req,
      [WebSymbols.NodeEntity]: req,
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
      [WebSymbols.ProviderEntity]: res,
      [WebSymbols.NodeEntity]: res,
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
      send(data): void {
        const contentType = res.getHeader('Content-Type');
        if (typeof contentType === 'string' && contentType.includes('json') && typeof data === 'string') {
          data = Buffer.from(data);
        }
        res.send(data);
      },
      on: res.on.bind(res),
      end: (val?: unknown): void => {
        if (val) {
          res.send(val);
        }
        res.end();
      },
      getHeaderNames: res.getHeaderNames.bind(res),
      setHeader: res.setHeader.bind(res),
      getHeader: castTo(res.getHeader.bind(res)), // NOTE: Forcing type, may be incorrect
      removeHeader: res.removeHeader.bind(res),
      write: res.write.bind(res)
    });
  }
}