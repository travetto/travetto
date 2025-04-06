import { Readable } from 'node:stream';

import { Injectable } from '@travetto/di';

import { WebFilterContext } from '../../src/types.ts';
import { WebResponse } from '../../src/types/response.ts';
import { WebRouter } from '../../src/application/router.ts';
import { WebDispatcher } from '@travetto/web';

/**
 * Support for invoking http requests directly
 */
@Injectable()
export class BasicWebDispatcher extends WebRouter implements WebDispatcher {

  async dispatch({ req }: WebFilterContext): Promise<WebResponse> {
    Object.assign(req, { remoteIp: '::1' });

    if (req.body && Buffer.isBuffer(req.body)) {
      Object.assign(req, { inputStream: Readable.from(req.body), body: undefined });
    }

    return await super.dispatch({ req });
  }
}