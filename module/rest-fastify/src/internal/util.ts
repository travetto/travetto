import { FastifyReply, FastifyRequest } from 'fastify';

import { RestServerUtil, Request, Response } from '@travetto/rest';
import { NodeEntityⲐ, ProviderEntityⲐ } from '@travetto/rest/src/internal/symbol';

/**
 * Provide a mapping between fastify request/response and the framework analogs
 */
export class FastifyServerUtil {
  /**
   * Build a Travetto Request from a Fastify Request
   */
  static getRequest(req: FastifyRequest & { session?: TravettoRequest['session'] }): Request {
    return RestServerUtil.decorateRequest({
      [ProviderEntityⲐ]: req,
      [NodeEntityⲐ]: req.raw,
      protocol: (req.raw.socket && 'encrypted' in req.raw.socket) ? 'https' : 'http',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      method: req.raw.method as Request['method'],
      url: req.raw!.url,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      query: req.query as Record<string, string>,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      params: req.params as Record<string, string>,
      body: req.body,
      session: req.session,
      headers: req.headers,
      files: undefined,
      auth: undefined,
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
        if ((reply.getHeader('Content-Type') ?? '').includes('json') && typeof data === 'string') {
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
      setHeader: reply.raw.setHeader.bind(reply.raw),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      getHeader: reply.raw.getHeader.bind(reply.raw) as (key: string) => string, // NOTE: Forcing type, may be incorrect
      removeHeader: reply.raw.removeHeader.bind(reply.raw),
      write: reply.raw.write.bind(reply.raw)
    });
  }
}