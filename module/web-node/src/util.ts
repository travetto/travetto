import type { IncomingMessage } from 'node:http';

import { castTo } from '@travetto/runtime';
import { WebRequest, WebResponse } from '@travetto/web';

export class NodeWebUtil {
  /**
   * Create a fetch request given a web request
   */
  static toFetchRequest(req: WebRequest): RequestInit & { path: string } {
    const { query, method, body, headers, path } = req;

    let q = '';
    if (query && Object.keys(query).length) {
      const pairs = Object.entries(query).map<[string, string]>(([k, v]) => [k, v === null || v === undefined ? '' : `${v}`]);
      q = `?${new URLSearchParams(pairs).toString()}`;
    }

    return { path: `${path}${q}`, method, headers, body, };
  }

  /**
   * Create a web request given a node IncomingMessage
   */
  static toWebRequest(req: IncomingMessage, params: Record<string, unknown>): WebRequest {
    const secure = 'encrypted' in req.socket && !!req.socket.encrypted;
    const url = new URL(`http${secure ? 's' : ''}://${req.headers.host}${req.url}`);

    return new WebRequest({
      protocol: secure ? 'https' : 'http',
      method: castTo(req.method?.toUpperCase()),
      path: url.pathname!,
      query: Object.fromEntries(url.searchParams.entries()),
      params,
      headers: req.headers,
      inputStream: req,
      remoteIp: req.socket.remoteAddress,
      port: req.socket.localPort
    });
  }

  /**
   * Create a WebResponse given a fetch Response
   */
  static async toWebResponse(res: Response): Promise<WebResponse> {
    const out = Buffer.from(await res.arrayBuffer());
    return WebResponse.from(out).with({ statusCode: res.status, headers: res.headers });
  }
}