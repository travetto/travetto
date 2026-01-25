import { Inject, Injectable } from '@travetto/di';
import { type WebFilterContext, WebResponse, type WebDispatcher, WebBodyUtil } from '@travetto/web';
import { BinaryUtil, castTo } from '@travetto/runtime';

import { WebTestDispatchUtil } from '@travetto/web/support/test/dispatch-util.ts';

import type { WebHttpConfig } from '../../src/config.ts';

/**
 * Support for invoking http requests against the server
 */
@Injectable()
export class FetchWebDispatcher implements WebDispatcher {

  @Inject()
  config: WebHttpConfig;

  async dispatch({ request }: WebFilterContext): Promise<WebResponse> {
    const baseRequest = await WebTestDispatchUtil.applyRequestBody(request);
    const finalPath = WebTestDispatchUtil.buildPath(baseRequest);
    const body: RequestInit['body'] = WebBodyUtil.isRaw(request.body) ? await BinaryUtil.toByteArray(request.body) : castTo(request.body);
    const { context: { httpMethod: method }, headers } = request;

    const response = await fetch(
      `${this.config.fetchUrl}${finalPath}`,
      { method, headers, body }
    );

    return await WebTestDispatchUtil.finalizeResponseBody(
      new WebResponse({
        body: await BinaryUtil.toByteArray(await response.arrayBuffer()),
        context: { httpStatusCode: response.status },
        headers: response.headers
      })
    );
  }
}