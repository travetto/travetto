import { ServerResponse } from 'http';
import * as fastify from 'fastify';

import { RestAppUtil } from '@travetto/rest';
import { TRV_ORIG, TRV_RAW, Request, Response } from '@travetto/rest/src/types';

const TRV_KEY = Symbol.for('@trv:rest-fastify/req');

type FRequest = fastify.FastifyRequest & {
  [TRV_KEY]?: Travetto.Request;
  session?: Record<string, any>;
  req?: { cookies: Request['cookies'] };
};

type FResponse = fastify.FastifyReply<ServerResponse> & {
  [TRV_KEY]: Travetto.Response;
  res?: { cookies: Response['cookies'] };
};

// TODO: Document
export class FastifyAppUtil {
  static getRequest(reqs: FRequest) {
    if (!reqs[TRV_KEY]) {
      let [path] = (reqs.req.url ?? '').split(/[#?]/g);
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }
      reqs[TRV_KEY] = RestAppUtil.decorateRequest({
        [TRV_ORIG]: reqs,
        [TRV_RAW]: reqs.req,
        protocol: 'encrypted' in reqs.req.socket ? 'https' : 'http',
        method: reqs.req.method,
        path,
        query: reqs.query,
        params: reqs.params,
        body: reqs.body,
        session: reqs.session,
        headers: reqs.headers,
        cookies: reqs.req.cookies,
        files: {},
        auth: undefined,
        pipe: reqs.req.pipe.bind(reqs.req),
        on: reqs.req.on.bind(reqs.req)
      });
    }
    return reqs[TRV_KEY]!;
  }

  static getResponse(reply: FResponse) {
    if (!reply[TRV_KEY]) {
      reply[TRV_KEY] = RestAppUtil.decorateResponse({
        [TRV_ORIG]: reply,
        [TRV_RAW]: reply.res,
        get headersSent() {
          return reply.sent;
        },
        status(val?: number): number | undefined {
          if (val) {
            reply.status(val);
            reply.res.statusCode = val;
          } else {
            return reply.res.statusCode;
          }
        },
        send(data) {
          if ((reply.getHeader('Content-Type') ?? '').includes('json') && typeof data === 'string') {
            data = Buffer.from(data);
          }
          reply.send(data);
        },
        on: reply.res.on.bind(reply.res),
        end: (val?: any) => {
          if (val) {
            reply.send(val);
          }
          reply.res.end();
        },
        setHeader: reply.res.setHeader.bind(reply.res),
        getHeader: reply.res.getHeader.bind(reply.res) as (key: string) => string, // NOTE: Forcing type, may be incorrect
        removeHeader: reply.res.removeHeader.bind(reply.res),
        write: reply.res.write.bind(reply.res),
        cookies: reply.res.cookies
      });
    }

    return reply[TRV_KEY]!;
  }
}