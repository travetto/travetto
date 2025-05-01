import { Injectable } from '@travetto/di';

import type { WebFilterContext } from '../../src/types/filter.ts';
import { WebResponse } from '../../src/types/response.ts';
import { StandardWebRouter } from '../../src/router/standard.ts';
import { WebTestDispatchUtil } from './dispatch-util.ts';

@Injectable()
export class LocalRequestDispatcher extends StandardWebRouter {
  async dispatch({ request }: WebFilterContext): Promise<WebResponse> {
    const resolved = await WebTestDispatchUtil.applyRequestBody(request);
    const res = await super.dispatch({ request: resolved });
    return WebTestDispatchUtil.finalizeResponseBody(res, true);
  }
}