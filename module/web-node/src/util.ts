import { type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { IncomingMessage, ServerResponse } from 'node:http';

import { WebInternal, HttpRequest, HttpResponse, HttpRequestCore, HttpResponseCore, HttpResponsePayload, HttpContext, HttpFilterNext } from '@travetto/web';
import { castTo, hasFunction } from '@travetto/runtime';

const isReadable = hasFunction<Readable>('pipe');

/**
 * Provide a mapping between node request/response and the framework analogs
 */
export class NodeWebServerUtil {

  /**
   * Convert request, response object from provider to framework
   */
  static getContext(req: IncomingMessage, res: ServerResponse, next: HttpFilterNext): HttpContext {
    const fullReq: typeof req & { [WebInternal]?: HttpRequest } = req;
    const fullRes: typeof res & { [WebInternal]?: HttpResponse } = res;
    const finalReq = fullReq[WebInternal] ??= this.getRequest(req);
    const finalRes = fullRes[WebInternal] ??= this.getResponse(res);
    return { req: finalReq, res: finalRes, next, config: undefined };
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
      get statusCode(): number | undefined {
        return res.statusCode;
      },
      set statusCode(code: number) {
        res.statusCode = code;
      },
      respond(this: HttpResponse, value?: HttpResponsePayload): Promise<void> | void {
        if (isReadable(value)) {
          return pipeline(value, res);
        } else {
          res.write(value);
          res.end();
        }
      },
      setHeader: res.setHeader.bind(res),
      getHeader: castTo(res.getHeader.bind(res)), // NOTE: Forcing type, may be incorrect
      removeHeader: res.removeHeader.bind(res),
    });
  }
}