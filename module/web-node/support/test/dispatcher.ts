import { buffer } from 'node:stream/consumers';

import { Inject, Injectable } from '@travetto/di';
import { WebConfig, WebFilterContext, WebResponse, WebDispatcher, WebBodyUtil } from '@travetto/web';
import { castTo } from '@travetto/runtime';

import { WebTestDispatchUtil } from '@travetto/web/support/test/dispatch-util.ts';

/**
 * Support for invoking http requests against the server
 */
@Injectable()
export class FetchWebDispatcher implements WebDispatcher {

  @Inject()
  config: WebConfig;

  async dispatch({ request }: WebFilterContext): Promise<WebResponse> {
    const { context: { httpQuery: query, httpMethod: method, path }, headers } = await WebTestDispatchUtil.applyRequestBody(request);

    let q = '';
    if (query && Object.keys(query).length) {
      const pairs = Object.entries(query).map<[string, string]>(([k, v]) => [k, v === null || v === undefined ? '' : `${v}`]);
      q = `?${new URLSearchParams(pairs).toString()}`;
    }

    const finalPath = `${path}${q}`;
    const stream = WebBodyUtil.getRawStream(request.body);
    const body: RequestInit['body'] = stream ? await buffer(stream) : castTo(request.body);

    const response = await fetch(`http://localhost:${this.config.port}${finalPath}`, { method, body, headers });

    return WebTestDispatchUtil.finalizeResponseBody(
      new WebResponse({
        body: Buffer.from(await response.arrayBuffer()),
        context: { httpStatusCode: response.status },
        headers: response.headers
      })
    );
  }
}