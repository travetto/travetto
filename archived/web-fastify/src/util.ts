import { FastifyReply, FastifyRequest } from 'fastify';

import { WebRequest } from '@travetto/web';
import { castTo } from '@travetto/runtime';

/**
 * Provide a mapping between fastify request/response and the framework analogs
 */
export class FastifyWebServerUtil {

  /**
   * Build a Travetto HttpRequest from a Fastify Request
   */
  static getRequest(req: FastifyRequest, reply: FastifyReply): WebRequest {
    return new WebRequest({
      protocol: (req.raw.socket && 'encrypted' in req.raw.socket) ? 'https' : 'http',
      method: castTo(req.raw.method?.toUpperCase()),
      path: req.url,
      query: castTo(req.query),
      params: castTo(req.params),
      headers: req.headers,
      inputStream: req.raw,
      body: req.body === req.raw ? undefined : req.body,
      port: req.raw.socket.localPort,
      remoteIp: req.raw.socket.remoteAddress,
      respond(value): unknown {
        value.headers.forEach((v, k) => reply.header(k, v));
        return reply
          .status(value.statusCode ?? 200)
          .send(value.output);
      }
    });
  }
}