import { IncomingMessage, ServerResponse } from 'node:http';

import { WebSymbols, HttpRequest, HttpResponse, HttpRequestCore, HttpResponseCore } from '@travetto/web';
import { castTo } from '@travetto/runtime';

/**
 * Provide a mapping between node request/response and the framework analogs
 */
export class NodeWebServerUtil {

  /**
   * Convert request, response object from provider to framework
   */
  static convert(req: IncomingMessage, res: ServerResponse): [HttpRequest, HttpResponse] {
    const fullReq: typeof req & { [WebSymbols.Internal]?: HttpRequest } = req;
    const fullRes: typeof res & { [WebSymbols.Internal]?: HttpResponse } = res;
    const finalReq = fullReq[WebSymbols.Internal] ??= this.getRequest(req);
    const finalRes = fullRes[WebSymbols.Internal] ??= this.getResponse(res);
    return [finalReq, finalRes];
  }

  /**
   * Build a Travetto HttpRequest from an Express Request
   */
  static getRequest(req: IncomingMessage & { params?: Record<string, string> }): HttpRequest {

    const url = new URL(req.url!);

    return HttpRequestCore.create({
      [WebSymbols.Internal]: {
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
      on: req.on.bind(req)
    });
  }

  /**
   * Build a Travetto HttpResponse from an Express Response
   */
  static getResponse(res: ServerResponse): HttpResponse {
    return HttpResponseCore.create({
      [WebSymbols.Internal]: {
        providerEntity: res,
        nodeEntity: res,
      },
      get headersSent(): boolean {
        return res.headersSent;
      },
      status(val?: number): number | undefined {
        if (val) {
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
        res.write(data);
        res.end();
      },
      on: res.on.bind(res),
      end: (val?: unknown): void => {
        if (val) {
          res.write(val);
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