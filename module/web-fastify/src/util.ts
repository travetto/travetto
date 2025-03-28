import { FastifyReply, FastifyRequest } from 'fastify';

import { HttpRequest } from '@travetto/web';
import { castTo } from '@travetto/runtime';

/**
 * Provide a mapping between fastify request/response and the framework analogs
 */
export class FastifyWebServerUtil {

  /**
   * Build a Travetto HttpRequest from a Fastify Request
   */
  static getRequest(req: FastifyRequest, reply: FastifyReply): HttpRequest {
    return new HttpRequest({
      protocol: (req.raw.socket && 'encrypted' in req.raw.socket) ? 'https' : 'http',
      method: castTo(req.raw.method),
      url: req.raw!.url!,
      path: req.url,
      query: castTo(req.query),
      params: castTo(req.params),
      headers: castTo(req.headers),
      inputStream: req.raw,
      body: req.body,
      port: req.raw.socket.localPort,
      remoteIp: req.raw.socket.remoteAddress,
      respond(value): unknown {
        return reply
          .status(value.statusCode ?? 200)
          .headers(value.headers.toObject())
          .send(value.output);
      }
    });
  }
}