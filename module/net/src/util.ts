import * as path from 'path';
import * as os from 'os';
import * as http from 'http';

import { HttpRequest } from './request';

import { FsUtil, StreamUtil } from '@travetto/boot';
import { Util } from '@travetto/base';

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
      async responseHandler(msg: http.IncomingMessage) {
        await StreamUtil.writeToFile(msg, filePath);
      }
    });

    return filePath;
  }
}