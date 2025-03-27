import { FastifyReply, FastifyRequest } from 'fastify';

import { WebInternal, HttpRequest, HttpRequestCore, HttpChainedContext } from '@travetto/web';
import { castTo } from '@travetto/runtime';

/**
 * Provide a mapping between fastify request/response and the framework analogs
 */
export class FastifyWebServerUtil {

  /**
   * Convert request, response object from provider to framework
   */
  static getContext(req: FastifyRequest, reply: FastifyReply): HttpChainedContext {
    const fullReq: typeof req & { [WebInternal]?: HttpChainedContext } = req;
    return fullReq[WebInternal] ??= {
      req: this.getRequest(req, reply),
      next: async () => null!,
      config: {}
    };
  }

  /**
   * Build a Travetto HttpRequest from a Fastify Request
   */
  static getRequest(req: FastifyRequest, reply: FastifyReply): HttpRequest {
    return HttpRequestCore.create({
      protocol: (req.raw.socket && 'encrypted' in req.raw.socket) ? 'https' : 'http',
      method: castTo(req.raw.method),
      url: req.raw!.url,
      query: castTo(req.query),
      params: castTo(req.params),
      headers: req.headers,
      pipe: req.raw.pipe.bind(req.raw),
    }, {
      providerReq: req,
      inputStream: req.raw,
      providerRes: reply,
      respond(value): unknown {
        return reply
          .status(value.statusCode ?? 200)
          .headers(value.getHeaders())
          .send(value.output);
      }
    });
  }
}