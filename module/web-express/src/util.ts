import { type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type express from 'express';

import { WebInternal, HttpRequest, HttpResponse, HttpRequestCore, HttpResponseCore, HttpContext } from '@travetto/web';
import { castTo, hasFunction } from '@travetto/runtime';

const isReadable = hasFunction<Readable>('pipe');

/**
 * Provide a mapping between express request/response and the framework analogs
 */
export class ExpressWebServerUtil {

  /**
   * Convert request, response object from provider to framework
   */
  static getContext(req: express.Request, res: express.Response, next: express.NextFunction): HttpContext {
    const fullReq: typeof req & { [WebInternal]?: HttpContext } = req;
    return fullReq[WebInternal] ??= {
      req: this.getRequest(req),
      res: this.getResponse(res),
      next, config: {}
    };
  }

  /**
   * Build a Travetto HttpRequest from an Express Request
   */
  static getRequest(req: express.Request): HttpRequest {
    return HttpRequestCore.create({
      [WebInternal]: {
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
    });
  }

  /**
   * Build a Travetto HttpResponse from an Express Response
   */
  static getResponse(res: express.Response): HttpResponse {
    return HttpResponseCore.create({
      [WebInternal]: {
        providerEntity: res,
        nodeEntity: res
      },
      get headersSent(): boolean {
        return res.headersSent;
      },
      get statusCode(): number | undefined {
        return res.statusCode;
      },
      set statusCode(code: number) {
        res.status(code);
        res.statusCode = code;
      },
      respond(value): Promise<void> | void {
        if (isReadable(value)) {
          return pipeline(value, res);
        } else {
          res.send(value);
          res.end();
        }
      },
      vary: res.vary.bind(res),
      getHeaderNames: res.getHeaderNames.bind(res),
      setHeader: res.setHeader.bind(res),
      getHeader: castTo(res.getHeader.bind(res)), // NOTE: Forcing type, may be incorrect
      removeHeader: res.removeHeader.bind(res),
    });
  }
}