import { FastifyReply, FastifyRequest } from 'fastify';

import { WebInternal, HttpRequest, HttpResponse, HttpRequestCore, HttpResponseCore, HttpContext } from '@travetto/web';
import { castTo } from '@travetto/runtime';

/**
 * Provide a mapping between fastify request/response and the framework analogs
 */
export class FastifyWebServerUtil {

  /**
   * Convert request, response object from provider to framework
   */
  static getContext(req: FastifyRequest, res: FastifyReply): HttpContext {
    const fullReq: typeof req & { [WebInternal]?: HttpRequest } = req;
    const fullRes: typeof res & { [WebInternal]?: HttpResponse } = res;
    return {
      req: fullReq[WebInternal] ??= this.getRequest(req),
      res: fullRes[WebInternal] ??= this.getResponse(res),
      next(): void { },
      config: {}
    };
  }

  /**
   * Build a Travetto HttpRequest from a Fastify Request
   */
  static getRequest(req: FastifyRequest): HttpRequest {
    return HttpRequestCore.create({
      [WebInternal]: {
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
    });
  }

  /**
   * Build a Travetto HttpResponse from a Fastify Reply
   */
  static getResponse(reply: FastifyReply): HttpResponse {
    return HttpResponseCore.create({
      [WebInternal]: {
        providerEntity: reply,
        nodeEntity: reply.raw
      },
      get headersSent(): boolean {
        return reply.sent;
      },
      get statusCode(): number | undefined {
        return reply.statusCode;
      },
      set statusCode(code: number) {
        reply.status(code);
        reply.raw.statusCode = code;
      },
      respond(value): void {
        reply.send(value);
      },
      getHeaderNames: reply.raw.getHeaderNames.bind(reply.raw),
      setHeader: reply.raw.setHeader.bind(reply.raw),
      getHeader: castTo(reply.raw.getHeader.bind(reply.raw)), // NOTE: Forcing type, may be incorrect
      removeHeader: reply.raw.removeHeader.bind(reply.raw),
    });
  }
}