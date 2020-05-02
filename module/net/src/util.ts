import * as path from 'path';
import * as os from 'os';
import { IncomingMessage } from 'http';

import { HttpRequest } from './request';

import { FsUtil } from '@travetto/boot';
import { Util } from '@travetto/base';
import { SystemUtil } from '@travetto/base/src/internal/system';

const tmpDir = FsUtil.toUnix(os.tmpdir());

/**
 * Common network utilities
 */
export class NetUtil {
  /**
   * Download a URL to a file on disk
   */
  static async download(url: string) {
    const name = `${Util.uuid()}.${path.basename(url)}`;
    const filePath = FsUtil.resolveUnix(tmpDir, name);

    await HttpRequest.exec({
      url,
      async responseHandler(msg: IncomingMessage) {
        await SystemUtil.streamToFile(msg, filePath);
      }
    });

    return filePath;
  }
}