import type { IncomingMessage, ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';

import { BinaryUtil, castTo } from '@travetto/runtime';
import { WebBodyUtil, WebRequest, WebResponse } from '@travetto/web';

export class NodeWebUtil {

  /**
   * Create a web request given a node IncomingMessage
   */
  static toWebRequest(req: IncomingMessage, params?: Record<string, unknown>): WebRequest {
    const secure = 'encrypted' in req.socket && !!req.socket.encrypted;
    const [path, query] = (req.url ?? '/').split('?') ?? [];
    return new WebRequest({
      connection: {
        ip: req.socket.remoteAddress!,
        host: req.headers.host,
        protocol: secure ? 'https' : 'http',
        port: req.socket.localPort
      },
      method: castTo(req.method?.toUpperCase()),
      path,
      query: Object.fromEntries(new URLSearchParams(query)),
      params,
      headers: req.headers,
      body: WebBodyUtil.asUnprocessed(req)
    });
  }

  /**
   * Send WebResponse to ServerResponse
   */
  static async respondToServerResponse(webRes: WebResponse, res: ServerResponse): Promise<void> {
    const binaryRes = WebResponse.toBinary(webRes);
    binaryRes.headers.forEach((v, k) => res.setHeader(k.toLowerCase(), v));
    res.statusCode = binaryRes.statusCode ?? 200;

    if (BinaryUtil.isReadable(binaryRes.body)) {
      await pipeline(binaryRes.body, res);
    } else {
      res.write(binaryRes.body);
      res.end();
    }
  }
}