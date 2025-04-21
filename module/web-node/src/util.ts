import type { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';

import { BinaryUtil, castTo } from '@travetto/runtime';
import { WebBodyUtil, WebCommonUtil, WebRequest, WebResponse } from '@travetto/web';

export class NodeWebUtil {

  /**
   * Create a web request given a node IncomingMessage
   */
  static toWebRequest(req: IncomingMessage, pathParams?: Record<string, unknown>): WebRequest {
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
        pathParams,
      },
      headers: req.headers,
      body: WebBodyUtil.markRaw(req)
    });
  }

  /**
   * Send WebResponse to ServerResponse
   */
  static async respondToServerResponse(webRes: WebResponse, res: ServerResponse): Promise<void> {
    const binaryResponse = new WebResponse({ ...webRes, ...WebBodyUtil.toBinaryMessage(webRes) });
    binaryResponse.headers.forEach((v, k) => res.setHeader(k.toLowerCase(), v));
    res.statusCode = WebCommonUtil.getStatusCode(binaryResponse);

    if (BinaryUtil.isReadable(binaryResponse.body)) {
      await pipeline(binaryResponse.body, res);
    } else {
      res.write(binaryResponse.body);
      res.end();
    }
  }
}