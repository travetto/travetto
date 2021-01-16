import { FastifyReply, FastifyRequest } from 'fastify';

import { RestServerUtil } from '@travetto/rest';
import { NodeResponseSym, NodeRequestSym, ProviderRequestSym, ProviderResponseSym, Request } from '@travetto/rest/src/types';

const RequestSym = Symbol.for('@trv:rest-fastify/req');
const ResponseSym = Symbol.for('@trv:rest-fastify/res');

type FRequest = FastifyRequest & {
  [RequestSym]?: Travetto.Request;
  session?: Travetto.Request['session'];
};

type FResponse = FastifyReply & {
  [ResponseSym]?: Travetto.Response;
};

/**
 * Provide a mapping between fastify request/response and the framework analogs
 */
export class FastifyServerUtil {
  /**
   * Build a Travetto Request from a Fastify Request
   */
  static getRequest(reqs: FRequest) {
    if (!reqs[RequestSym]) {
      let [path] = (reqs.raw!.url ?? '').split(/[#?]/g);
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }
      reqs[RequestSym] = RestServerUtil.decorateRequest({
        [ProviderRequestSym]: reqs,
        [NodeRequestSym]: reqs.raw,
        protocol: (reqs.raw.socket && 'encrypted' in reqs.raw.socket) ? 'https' : 'http',
        method: reqs.raw.method as Request['method'],
        path,
        query: reqs.query as Record<string, string>,
        params: reqs.params as Record<string, string>,
        body: reqs.body,
        session: reqs.session,
        headers: reqs.headers as Record<string, string | string[]>,
        files: undefined,
        auth: undefined,
        pipe: reqs.raw.pipe.bind(reqs.raw),
        on: reqs.raw.on.bind(reqs.raw)
      });
    }
    return reqs[RequestSym]!;
  }

  /**
   * Build a Travetto Response from a Fastify Reply
   */
  static getResponse(reply: FResponse) {
    if (!reply[ResponseSym]) {
      reply[ResponseSym] = RestServerUtil.decorateResponse({
        [ProviderResponseSym]: reply,
        [NodeResponseSym]: reply.raw,
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

    return reply[ResponseSym]!;
  }
}