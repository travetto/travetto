import { FastifyReply, FastifyRequest } from 'fastify';

import { HttpHeaderUtil, HttpRequest } from '@travetto/web';
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
      method: req.raw.method!,
      path: req.url,
      query: castTo(req.query),
      params: castTo(req.params),
      headers: req.headers,
      inputStream: req.raw,
      body: req.body === req.raw ? undefined : req.body,
      port: req.raw.socket.localPort,
      remoteIp: req.raw.socket.remoteAddress,
      respond(value): unknown {
        HttpHeaderUtil.applyTo(value.headers, reply.header.bind(reply));
        return reply
          .status(value.statusCode ?? 200)
          .send(value.output);
      }
    });
  }
}