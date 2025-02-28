import { FastifyReply, FastifyRequest } from 'fastify';

import { RestSymbols, RestServerUtil, HttpRequest, HttpResponse } from '@travetto/rest';
import { castTo } from '@travetto/runtime';

/**
 * Provide a mapping between fastify request/response and the framework analogs
 */
export class FastifyRestServerUtil {
  /**
   * Build a Travetto HttpRequest from a Fastify Request
   */
  static getRequest(req: FastifyRequest): HttpRequest {
    return RestServerUtil.decorateRequest({
      [RestSymbols.ProviderEntity]: req,
      [RestSymbols.NodeEntity]: req.raw,
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
    return RestServerUtil.decorateResponse({
      [RestSymbols.ProviderEntity]: reply,
      [RestSymbols.NodeEntity]: reply.raw,
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