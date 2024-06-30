import { Readable } from 'node:stream';

import { path } from '@travetto/manifest';
import { ByteRange, Renderable, Response } from '@travetto/rest';
import { StreamMeta } from '@travetto/model';

export class RestModelUtil {
  /**
   * Make any stream response downloadable
   */
  static downloadable(stream: Readable, meta: StreamMeta, range?: ByteRange): Renderable {
    return {
      render(res: Response): Readable {
        res.setHeader('Content-Type', meta.contentType);
        if (meta.filename) {
          res.setHeader('Content-Disposition', `attachment;filename=${path.basename(meta.filename)}`);
        }
        if (meta.contentEncoding) {
          res.setHeader('Content-Encoding', meta.contentEncoding);
        }
        if (meta.contentLanguage) {
          res.setHeader('Content-Language', meta.contentLanguage);
        }
        if (meta.cacheControl) {
          res.setHeader('Cache-Control', meta.cacheControl);
        }
        if (!range) {
          res.setHeader('Content-Length', `${meta.size}`);
          res.status(200);
        } else {
          const { start, end } = range;
          res.status(206);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Range', `bytes ${start}-${end}/${meta.size}`);
          res.setHeader('Content-Length', `${end - start + 1}`);
        }
        return stream;
      }
    };
  }
}