import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import type express from 'express';

import { WebInternal, HttpRequest, HttpResponse, HttpRequestCore, HttpResponseCore, HttpChainedContext } from '@travetto/web';
import { castTo, hasFunction } from '@travetto/runtime';

const isReadable = hasFunction<Readable>('pipe');

/**
 * Provide a mapping between express request/response and the framework analogs
 */
export class ExpressWebServerUtil {

  /**
   * Convert request, response object from provider to framework
   */
  static getContext(req: express.Request, res: express.Response, next: express.NextFunction): HttpChainedContext {
    const fullReq: typeof req & { [WebInternal]?: HttpChainedContext } = req;
    return fullReq[WebInternal] ??= {
      req: this.getRequest(req),
      res: this.getResponse(res),
      next,
      config: {}
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
        nodeEntity: res,
        requestMethod: res.req.method
      },
      get headersSent(): boolean {
        return res.headersSent;
      },
      respond(value) {
        res.status(value.statusCode ?? 200);
        res.setHeaders(new Map(Object.entries(value.headers)));
        if (isReadable(value.output)) {
          return pipeline(value.output, res);
        } else {
          res.end(value.output);
        }
      }
    });
  }
}