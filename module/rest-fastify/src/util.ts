import { ServerResponse, IncomingMessage } from 'http';
import * as fastify from 'fastify';

import { RestAppUtil } from '@travetto/rest';

const TRV_KEY = Symbol('TRV_KEY');

export class FastifyAppUtil {
  static getRequest(reqs: fastify.FastifyRequest<IncomingMessage>) {
    if (!(reqs as any)[TRV_KEY]) {
      (reqs as any)[TRV_KEY] = RestAppUtil.decorateRequest({
        __raw: reqs,
        method: reqs.req.method,
        path: reqs.req.url!,
        query: reqs.query,
        params: reqs.params,
        body: (reqs as any).body,
        session: (reqs as any).session,
        headers: reqs.headers,
        cookies: (reqs as any).cookies,
        files: {},
        auth: undefined as any,
        pipe: reqs.req.pipe.bind(reqs.req),
        on: reqs.req.on.bind(reqs.req)
      });
    }
    return (reqs as any)[TRV_KEY];
  }

  static getResponse(reply: fastify.FastifyReply<ServerResponse>) {
    if (!(reply as any)[TRV_KEY]) {
      (reply as any)[TRV_KEY] = RestAppUtil.decorateResponse({
        __raw: reply,
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
        send: reply.send.bind(reply),
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
        cookie: (reply as any).setCookie.bind(reply)
      });
    }

    return (reply as any)[TRV_KEY];
  }
}