import { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import { WebInternal, HttpRequest, HttpRequestCore, HttpChainedContext, } from '@travetto/web';
import { castTo, hasFunction } from '@travetto/runtime';

const isReadable = hasFunction<Readable>('pipe');

/**
 * Provide a mapping between node request/response and the framework analogs
 */
export class NodeWebServerUtil {

  /**
   * Convert request, response object from provider to framework
   */
  static getContext(req: IncomingMessage, res: ServerResponse): HttpChainedContext {
    const fullReq: typeof req & { [WebInternal]?: HttpChainedContext } = req;
    return fullReq[WebInternal] ??= {
      req: this.getRequest(req, res),
      next: async () => null!,
      config: {}
    };
  }

  /**
   * Build a Travetto HttpRequest from an Express Request
   */
  static getRequest(
    req: IncomingMessage & { originalUrl?: string, secure?: boolean, params?: Record<string, string> },
    res: ServerResponse
  ): HttpRequest {

    const url = new URL(`http${req.secure ? 's' : ''}://${req.headers.host}${req.originalUrl}`);

    return HttpRequestCore.create({
      protocol: req.secure ? 'https' : 'http',
      method: castTo(req.method),
      url: req.originalUrl,
      path: url.pathname!,
      query: Object.fromEntries(url.searchParams.entries()),
      params: req.params,
      headers: req.headers,
      pipe: req.pipe.bind(req),
    }, {
      providerReq: req,
      providerRes: res,
      inputStream: req,
      async respond(value) {
        res.statusCode = value.statusCode ?? 200;
        res.setHeaders(new Map(Object.entries(value.getHeaders())));
        if (isReadable(value.output)) {
          await pipeline(value.output, res);
        } else {
          res.end(value.output);
        }
      }
    });
  }
}