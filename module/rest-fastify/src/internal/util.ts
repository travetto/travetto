import { FastifyReply, FastifyRequest } from 'fastify';

import { RestServerUtil, Request } from '@travetto/rest';
import { NodeEntityⲐ, ProviderEntityⲐ } from '@travetto/rest/src/internal/symbol';

/**
 * Provide a mapping between fastify request/response and the framework analogs
 */
export class FastifyServerUtil {
  /**
   * Build a Travetto Request from a Fastify Request
   */
  static getRequest(reqs: FastifyRequest & { session?: TravettoRequest['session'] }) {
    return RestServerUtil.decorateRequest({
      [ProviderEntityⲐ]: reqs,
      [NodeEntityⲐ]: reqs.raw,
      protocol: (reqs.raw.socket && 'encrypted' in reqs.raw.socket) ? 'https' : 'http',
      method: reqs.raw.method as Request['method'],
      url: reqs.raw!.url,
      query: reqs.query as Record<string, string>,
      params: reqs.params as Record<string, string>,
      body: reqs.body,
      session: reqs.session,
      headers: reqs.headers,
      files: undefined,
      auth: undefined,
      pipe: reqs.raw.pipe.bind(reqs.raw),
      on: reqs.raw.on.bind(reqs.raw)
    });
  }

  /**
   * Build a Travetto Response from a Fastify Reply
   */
  static getResponse(reply: FastifyReply) {
    return RestServerUtil.decorateResponse({
      [ProviderEntityⲐ]: reply,
      [NodeEntityⲐ]: reply.raw,
      get headersSent() {
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
      send(data) {
        if ((reply.getHeader('Content-Type') ?? '').includes('json') && typeof data === 'string') {
          data = Buffer.from(data);
        }
        reply.send(data);
      },
      on: reply.raw.on.bind(reply.raw),
      end: (val?: unknown) => {
        if (val) {
          reply.send(val);
        }
        reply.raw.end();
      },
      setHeader: reply.raw.setHeader.bind(reply.raw),
      getHeader: reply.raw.getHeader.bind(reply.raw) as (key: string) => string, // NOTE: Forcing type, may be incorrect
      removeHeader: reply.raw.removeHeader.bind(reply.raw),
      write: reply.raw.write.bind(reply.raw)
    });
  }
}