import { Readable } from 'node:stream';
import { buffer as toBuffer } from 'node:stream/consumers';
import { BinaryUtil } from '@travetto/runtime';

import { WebFilterContext } from '../../src/types.ts';
import { WebResponse } from '../../src/types/response.ts';
import { WebBodyUtil } from '../../src/util/body.ts';
import { StandardWebRouter } from '../../src/router/standard.ts';
import { DecompressInterceptor } from '../../src/interceptor/decompress.ts';
import { Injectable } from '@travetto/di';

@Injectable()
export class LocalRequestDispatcher extends StandardWebRouter {

  async dispatch({ req }: WebFilterContext): Promise<WebResponse> {
    const res = await super.dispatch({ req: req.secure(true) });
    const body = res.body;

    if (Buffer.isBuffer(body) || BinaryUtil.isReadable(body)) {
      const bufferResult = res.body = await WebBodyUtil.toBuffer(body);
      if (bufferResult.length) {
        try {
          res.body = await toBuffer(DecompressInterceptor.decompress(
            res.headers,
            Readable.from(bufferResult),
            { applies: true, supportedEncodings: ['br', 'deflate', 'gzip', 'identity'] }
          ));
        } catch { }
      }
    }

    return res;
  }
}