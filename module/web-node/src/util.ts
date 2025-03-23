import { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import { WebInternal, HttpRequest, HttpResponse, HttpRequestCore, HttpResponseCore, HttpChainedContext, } from '@travetto/web';
import { castTo, hasFunction } from '@travetto/runtime';

const isReadable = hasFunction<Readable>('pipe');

/**
 * Provide a mapping between node request/response and the framework analogs
 */
export class NodeWebServerUtil {

  /**
   * Convert request, response object from provider to framework
   */
  static getContext(req: IncomingMessage, res: ServerResponse, next: () => unknown): HttpChainedContext {
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
  static getRequest(req: IncomingMessage & { params?: Record<string, string> }): HttpRequest {

    const url = new URL(req.url!);

    return HttpRequestCore.create({
      [WebInternal]: {
        providerEntity: req,
        nodeEntity: req,
      },
      protocol: castTo(url.protocol),
      method: castTo(req.method),
      url: req.url!,
      query: Object.fromEntries(url.searchParams.entries()),
      params: req.params,
      headers: req.headers,
      pipe: req.pipe.bind(req),
    });
  }

  /**
   * Build a Travetto HttpResponse from an Express Response
   */
  static getResponse(res: ServerResponse): HttpResponse {
    return HttpResponseCore.create({
      [WebInternal]: {
        providerEntity: res,
        nodeEntity: res
      },
      get headersSent(): boolean {
        return res.headersSent;
      },
      respond(value) {
        res.statusCode = this.statusCode ?? 200;
        res.setHeaders(new Map(Object.entries(this.getHeaders!())));
        if (isReadable(value)) {
          return pipeline(value, res);
        } else {
          res.write(value);
          res.end();
        }
      }
    });
  }
}