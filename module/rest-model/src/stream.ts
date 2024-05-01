import { Readable } from 'node:stream';

import { path } from '@travetto/manifest';
import { StreamResponse } from '@travetto/model';
import { Renderable, Response } from '@travetto/rest';

export class ModelStreamUtil {
  /**
   * Make any stream response downloadable
   */
  static downloadable(asset: StreamResponse): Renderable {
    return {
      render(res: Response): Readable {
        res.setHeader('Content-Type', asset.contentType);
        if (asset.filename) {
          res.setHeader('Content-Disposition', `attachment;filename=${path.basename(asset.filename)}`);
        }
        if (asset.contentEncoding) {
          res.setHeader('Content-Encoding', asset.contentEncoding);
        }
        if (asset.contentLanguage) {
          res.setHeader('Content-Language', asset.contentLanguage);
        }
        if (asset.cacheControl) {
          res.setHeader('Cache-Control', asset.cacheControl);
        }
        if (!asset.range) {
          res.setHeader('Content-Length', `${asset.size}`);
          res.status(200);
        } else {
          const [start, end] = asset.range;
          res.status(206);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Range', `bytes ${start}-${end}/${asset.size}`);
          res.setHeader('Content-Length', `${end - start + 1}`);
        }
        return asset.stream!();
      }
    };
  }
}