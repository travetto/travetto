import { Readable } from 'node:stream';

import { Injectable } from '@travetto/di';

import { WebDispatcher, WebFilterContext } from '../../src/types.ts';
import { WebResponse } from '../../src/types/response.ts';
import { StandardWebRouter } from '../../src/router/standard.ts';

/**
 * Support for invoking http requests directly
 */
@Injectable()
export class BasicWebDispatcher extends StandardWebRouter implements WebDispatcher {

  async dispatch({ req }: WebFilterContext): Promise<WebResponse> {
    Object.assign(req, { remoteIp: '::1' });

    if (req.body && Buffer.isBuffer(req.body)) {
      req.body = Readable.from(req.body);
    }

    return await super.dispatch({ req });
  }
}