import { FastifyReply, FastifyRequest } from 'fastify';

import { WebSymbols, HttpRequest, HttpResponse, HttpRequestCore, HttpResponseCore } from '@travetto/web';
import { castTo } from '@travetto/runtime';

/**
 * Provide a mapping between fastify request/response and the framework analogs
 */
export class FastifyWebServerUtil {

  /**
   * Convert request, response object from provider to framework
   */
  static convert(req: FastifyRequest, res: FastifyReply): [HttpRequest, HttpResponse] {
    const fullReq: typeof req & { [WebSymbols.Internal]?: HttpRequest } = req;
    const fullRes: typeof res & { [WebSymbols.Internal]?: HttpResponse } = res;
    const finalReq = fullReq[WebSymbols.Internal] ??= this.getRequest(req);
    const finalRes = fullRes[WebSymbols.Internal] ??= this.getResponse(res);
    return [finalReq, finalRes];
  }

  /**
   * Build a Travetto HttpRequest from a Fastify Request
   */
  static getRequest(req: FastifyRequest): HttpRequest {
    return HttpRequestCore.create({
      [WebSymbols.Internal]: {
        providerEntity: req,
        nodeEntity: req.raw,
      },
      protocol: (req.raw.socket && 'encrypted' in req.raw.socket) ? 'https' : 'http',
      method: castTo(req.raw.method),
      url: req.raw!.url,
      query: castTo(req.query),
      params: castTo(req.params),
      headers: req.headers,
      pipe: req.raw.pipe.bind(req.raw),
      on: req.raw.on.bind(req.raw)
    });
  }

  /**
   * Build a Travetto HttpResponse from a Fastify Reply
   */
  static getResponse(reply: FastifyReply): HttpResponse {
    return HttpResponseCore.create({
      [WebSymbols.Internal]: {
        providerEntity: reply,
        nodeEntity: reply.raw
      },
      get headersSent(): boolean {
        return reply.sent;
      },
      status(val?: number): number | undefined {
        if (val) {
          reply.status(val);
          reply.raw.statusCode = val;
        } else {
          return reply.raw.statusCode;
        }
      },
      send(data): void {
        const type = (reply.getHeader('Content-Type') ?? '');
        if (typeof type === 'string' && type.includes('json') && typeof data === 'string') {
          data = Buffer.from(data);
        }
        reply.send(data);
      },
      on: reply.raw.on.bind(reply.raw),
      end: (val?: unknown): void => {
        if (val) {
          reply.send(val);
        }
        reply.raw.end();
      },
      getHeaderNames: reply.raw.getHeaderNames.bind(reply.raw),
      setHeader: reply.raw.setHeader.bind(reply.raw),
      getHeader: castTo(reply.raw.getHeader.bind(reply.raw)), // NOTE: Forcing type, may be incorrect
      removeHeader: reply.raw.removeHeader.bind(reply.raw),
      write: reply.raw.write.bind(reply.raw)
    });
  }
}