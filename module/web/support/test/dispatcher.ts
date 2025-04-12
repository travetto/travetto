import { Injectable } from '@travetto/di';

import { WebFilterContext } from '../../src/types.ts';
import { WebResponse } from '../../src/types/response.ts';
import { StandardWebRouter } from '../../src/router/standard.ts';
import { WebTestDispatchUtil } from './dispatch-util.ts';
import { WebRequest } from '../../src/types/request.ts';

@Injectable()
export class LocalRequestDispatcher extends StandardWebRouter {
  async dispatch({ req }: WebFilterContext): Promise<WebResponse> {
    const res = await super.dispatch({ req: WebRequest.secure(req, ['*']) });
    return WebTestDispatchUtil.finalizeResponseBody(res, true);
  }
}