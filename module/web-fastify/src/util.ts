import { FastifyReply, FastifyRequest } from 'fastify';

import { WebInternal, HttpRequest, HttpResponse, HttpRequestCore, HttpResponseCore, HttpChainedContext } from '@travetto/web';
import { castTo } from '@travetto/runtime';

/**
 * Provide a mapping between fastify request/response and the framework analogs
 */
export class FastifyWebServerUtil {

  /**
   * Convert request, response object from provider to framework
   */
  static getContext(req: FastifyRequest, res: FastifyReply): HttpChainedContext {
    const fullRes: typeof res & { [WebInternal]?: HttpChainedContext } = res;
    return fullRes[WebInternal] ??= {
      req: this.getRequest(req),
      res: this.getResponse(res),
      next: (): void => { },
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
        nodeEntity: reply.raw,
        requestMethod: reply.request.method,
        takeControlOfResponse: () => {
          reply.hijack();
        }
      },
      get headersSent(): boolean {
        return reply.sent;
      },
      respond(value): unknown {
        return reply
          .status(value.statusCode ?? 200)
          .headers(value.headers)
          .send(value.output);
      }
    });
  }
}