import { ServerResponse, IncomingMessage } from 'http';
import * as fastify from 'fastify';

import { RestAppUtil } from '@travetto/rest';
import { TRV_ORIG, TRV_RAW } from '@travetto/rest/src/types';

const TRV_KEY = Symbol.for('@trv:rest-fastify/req');

// TODO: Document
export class FastifyAppUtil {
  static getRequest(reqs: fastify.FastifyRequest<IncomingMessage>) {
    if (!(reqs as any)[TRV_KEY]) {
      let [path] = (reqs.req.url ?? '').split(/[#?]/g);
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }
      (reqs as any)[TRV_KEY] = RestAppUtil.decorateRequest({
        [TRV_ORIG]: reqs,
        [TRV_RAW]: reqs.req,
        protocol: 'encrypted' in reqs.req.socket ? 'https' : 'http',
        method: reqs.req.method,
        path,
        query: reqs.query,
        params: reqs.params,
        body: (reqs as any).body,
        session: (reqs as any).session,
        headers: reqs.headers,
        cookies: (reqs as any).req.cookies,
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
        cookies: (reply.res as any).cookies
      });
    }

    return (reply as any)[TRV_KEY];
  }
}