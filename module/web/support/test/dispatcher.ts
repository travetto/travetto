import { Injectable } from '@travetto/di';
import { BinaryUtil } from '@travetto/runtime';

import { WebFilterContext } from '../../src/types.ts';
import { WebResponse } from '../../src/types/response.ts';
import { StandardWebRouter } from '../../src/router/standard.ts';
import { WebTestDispatchUtil } from './dispatch-util.ts';
import { WebRequest } from '../../src/types/request.ts';

@Injectable()
export class LocalRequestDispatcher extends StandardWebRouter {
  async dispatch({ req }: WebFilterContext): Promise<WebResponse> {
    if (Buffer.isBuffer(req.body) || BinaryUtil.isReadable(req.body)) {
      req.body = WebRequest.markUnprocessed(req.body);
    }
    const res = await super.dispatch({ req: req.secure(true) });
    return WebTestDispatchUtil.finalizeResponseBody(res, true);
  }
}