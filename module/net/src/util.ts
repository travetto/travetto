import * as os from 'os';
import * as fs from 'fs';
import { IncomingMessage } from 'http';
import { HttpRequest } from './request';

import { FsUtil } from '@travetto/boot';

const tmpDir = FsUtil.toUnix(os.tmpdir());

export class NetUtil {
  static generateTempFile(ext: string): string {
    const now = new Date();
    const name = `asset-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${process.pid}-${(Math.random() * 100000000 + 1).toString(36)}.${ext}`;
    return FsUtil.resolveUnix(tmpDir, name);
  }

  static async downloadUrl(url: string) {
    const filePath = this.generateTempFile(url.split('/').pop() as string);
    const file = fs.createWriteStream(filePath);

    await HttpRequest.exec({
      url, responseHandler: async (msg: IncomingMessage) => {
        await HttpRequest.pipe(msg, file);
      }
    });

    return filePath;
  }
}