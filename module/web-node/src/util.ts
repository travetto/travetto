import type { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';

import { BinaryUtil, castTo } from '@travetto/runtime';
import { WebBodyUtil, WebCommonUtil, WebRequest, WebResponse } from '@travetto/web';

export class NodeWebUtil {

  /**
   * Create a web request given a node IncomingMessage
   */
  static toWebRequest(req: IncomingMessage, params?: Record<string, unknown>): WebRequest {
    const secure = 'encrypted' in req.socket && !!req.socket.encrypted;
    const [path, query] = (req.url ?? '/').split('?') ?? [];
    return new WebRequest({
      context: {
        connection: {
          ip: req.socket.remoteAddress!,
          host: req.headers.host,
          httpProtocol: secure ? 'https' : 'http',
          port: req.socket.localPort
        },
        httpMethod: castTo(req.method?.toUpperCase()),
        path,
        httpQuery: Object.fromEntries(new URLSearchParams(query)),
        pathParams: params,
      },
      headers: req.headers,
      body: WebBodyUtil.markRaw(req)
    });
  }

  /**
   * Send WebResponse to ServerResponse
   */
  static async respondToServerResponse(webRes: WebResponse, res: ServerResponse): Promise<void> {
    const binaryRes = new WebResponse({ ...webRes, ...WebBodyUtil.toBinaryMessage(webRes) });
    binaryRes.headers.forEach((v, k) => res.setHeader(k.toLowerCase(), v));
    res.statusCode = WebCommonUtil.getStatusCode(binaryRes);

    if (BinaryUtil.isReadable(binaryRes.body)) {
      await pipeline(binaryRes.body, res);
    } else {
      res.write(binaryRes.body);
      res.end();
    }
  }
}