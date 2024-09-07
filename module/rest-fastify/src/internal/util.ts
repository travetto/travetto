import { FastifyReply, FastifyRequest } from 'fastify';

import { RestServerUtil, Request, Response } from '@travetto/rest';
import { NodeEntityⲐ, ProviderEntityⲐ } from '@travetto/rest/src/internal/symbol';
import { castTo } from '@travetto/runtime';

/**
 * Provide a mapping between fastify request/response and the framework analogs
 */
export class FastifyServerUtil {
  /**
   * Build a Travetto Request from a Fastify Request
   */
  static getRequest(req: FastifyRequest & { session?: Request['session'] }): Request {
    return RestServerUtil.decorateRequest({
      [ProviderEntityⲐ]: req,
      [NodeEntityⲐ]: req.raw,
      protocol: (req.raw.socket && 'encrypted' in req.raw.socket) ? 'https' : 'http',
      method: castTo(req.raw.method),
      url: req.raw!.url,
      query: castTo(req.query),
      params: castTo(req.params),
      session: req.session,
      headers: req.headers,
      pipe: req.raw.pipe.bind(req.raw),
      on: req.raw.on.bind(req.raw)
    });
  }

  /**
   * Build a Travetto Response from a Fastify Reply
   */
  static getResponse(reply: FastifyReply): Response {
    return RestServerUtil.decorateResponse({
      [ProviderEntityⲐ]: reply,
      [NodeEntityⲐ]: reply.raw,
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