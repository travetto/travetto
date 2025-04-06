import { Readable } from 'node:stream';

import { Injectable } from '@travetto/di';

import { WebFilterContext } from '../../src/types.ts';
import { WebResponse } from '../../src/types/response.ts';
import { CoreWebRouter } from '../../src/application/router.ts';

/**
 * Support for invoking http requests directly
 */
@Injectable()
export class BasicWebRouter extends CoreWebRouter {

  async execute({ req }: WebFilterContext): Promise<WebResponse> {
    Object.assign(req, { remoteIp: '::1' });

    if (req.body && Buffer.isBuffer(req.body)) {
      Object.assign(req, { inputStream: Readable.from(req.body), body: undefined });
    }

    return await super.execute({ req });
  }
}