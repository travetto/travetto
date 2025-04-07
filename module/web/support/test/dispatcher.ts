import { Readable } from 'node:stream';

import { Injectable } from '@travetto/di';

import { WebFilterContext } from '../../src/types.ts';
import { WebResponse } from '../../src/types/response.ts';
import { StandardWebRouter } from '../../src/router/standard.ts';
import { WebDispatcher } from '../../src/types/application.ts';

/**
 * Support for invoking http requests directly
 */
@Injectable()
export class BasicWebDispatcher extends StandardWebRouter implements WebDispatcher {

  async dispatch({ req }: WebFilterContext): Promise<WebResponse> {
    Object.assign(req, { remoteIp: '::1' });

    if (req.body && Buffer.isBuffer(req.body)) {
      Object.assign(req, { inputStream: Readable.from(req.body), body: undefined });
    }

    return await super.dispatch({ req });
  }
}