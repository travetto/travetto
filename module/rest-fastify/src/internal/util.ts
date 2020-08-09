import { FastifyReply, FastifyRequest } from 'fastify';

import { RestServerUtil } from '@travetto/rest';
import { TRV_ORIG, TRV_RAW, Request, Response } from '@travetto/rest/src/types';

const TRV_KEY = Symbol.for('@trv:rest-fastify/req');

type FRequest = FastifyRequest & {
  [TRV_KEY]?: Travetto.Request;
  session?: Record<string, any>;
};

type FResponse = FastifyReply & {
  [TRV_KEY]?: Travetto.Response;
};

/**
 * Provide a mapping between fastify request/response and the framework analogs
 */
export class FastifyServerUtil {
  /**
   * Build a Travetto Request from a Fastify Request
   */
  static getRequest(reqs: FRequest) {
    if (!reqs[TRV_KEY]) {
      let [path] = (reqs.raw!.url ?? '').split(/[#?]/g);
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }
      reqs[TRV_KEY] = RestServerUtil.decorateRequest({
        [TRV_ORIG]: reqs,
        [TRV_RAW]: reqs.raw,
        protocol: (reqs.raw.socket && 'encrypted' in reqs.raw.socket) ? 'https' : 'http',
        method: reqs.raw.method as Request['method'],
        path,
        query: reqs.query as Record<string, string>,
        params: reqs.params as Record<string, string>,
        body: reqs.body,
        session: reqs.session,
        headers: reqs.headers as Record<string, string | string[]>,
        files: {},
        auth: undefined,
        pipe: reqs.raw.pipe.bind(reqs.raw),
        on: reqs.raw.on.bind(reqs.raw)
      });
    }
    return reqs[TRV_KEY]!;
  }

  /**
   * Build a Travetto Response from a Fastify Reply
   */
  static getResponse(reply: FResponse) {
    if (!reply[TRV_KEY]) {
      reply[TRV_KEY] = RestServerUtil.decorateResponse({
        [TRV_ORIG]: reply,
        [TRV_RAW]: reply.raw,
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
        end: (val?: any) => {
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

    return reply[TRV_KEY]!;
  }
}