import { Inject, Injectable } from '@travetto/di';
import { WebFilterContext, WebResponse, WebDispatcher } from '@travetto/web';
import { WebHttpConfig } from '@travetto/web-server';

import { WebTestDispatchUtil } from '@travetto/web/support/test/dispatch-util.ts';

/**
 * Support for invoking http requests against the server
 */
@Injectable()
export class FetchWebDispatcher implements WebDispatcher {

  @Inject()
  config: WebHttpConfig;

  async dispatch({ request }: WebFilterContext): Promise<WebResponse> {
    const { path: finalPath, init } = await WebTestDispatchUtil.toFetchRequestInit(
      await WebTestDispatchUtil.applyRequestBody(request)
    );
    const response = await fetch(`http://localhost:${this.config.port}${finalPath}`, init);
    return await WebTestDispatchUtil.finalizeResponseBody(
      await WebTestDispatchUtil.fromFetchResponse(response)
    );
  }
}