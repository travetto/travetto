import { FastifyReply, FastifyRequest } from 'fastify';

import { RestServerUtil, Request } from '@travetto/rest';
import { TravettoEntitySym, NodeEntitySym, ProviderEntitySym } from '@travetto/rest/src/internal/symbol';

type FRequest = FastifyRequest & {
  [TravettoEntitySym]?: Travetto.Request;
  session?: Travetto.Request['session'];
};

type FResponse = FastifyReply & {
  [TravettoEntitySym]?: Travetto.Response;
};

/**
 * Provide a mapping between fastify request/response and the framework analogs
 */
export class FastifyServerUtil {
  /**
   * Build a Travetto Request from a Fastify Request
   */
  static getRequest(reqs: FRequest) {
    if (!reqs[TravettoEntitySym]) {
      let [path] = (reqs.raw!.url ?? '').split(/[#?]/g);
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }
      reqs[TravettoEntitySym] = RestServerUtil.decorateRequest({
        [ProviderEntitySym]: reqs,
        [NodeEntitySym]: reqs.raw,
        protocol: (reqs.raw.socket && 'encrypted' in reqs.raw.socket) ? 'https' : 'http',
        method: reqs.raw.method as Request['method'],
        path,
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
    return reqs[TravettoEntitySym]!;
  }

  /**
   * Build a Travetto Response from a Fastify Reply
   */
  static getResponse(reply: FResponse) {
    if (!reply[TravettoEntitySym]) {
      reply[TravettoEntitySym] = RestServerUtil.decorateResponse({
        [ProviderEntitySym]: reply,
        [NodeEntitySym]: reply.raw,
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

    return reply[TravettoEntitySym]!;
  }
}