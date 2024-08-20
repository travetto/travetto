import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import stream, { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

import { BlobUtil, IOUtil } from '@travetto/io';
import { Util } from '@travetto/runtime';

/**
 * General support for handling file uploads/downloads
 */
export class RestUploadUtil {

  static async cleanupFiles(fileMap: Record<string, Blob>): Promise<void> {
    await Promise.all(Object.values(fileMap ?? {}).map(x => BlobUtil.cleanupBlob(x)));
  }

  /**
   * Convert stream or buffer to a file, enforcing max size if needed
   * @param data
   * @param filename
   * @param maxSize
   */
  static async writeToFile(data: stream.Readable | Buffer, filename: string, maxSize?: number): Promise<string> {
    const uniqueDir = path.resolve(os.tmpdir(), `upload_${Date.now()}_${Util.uuid(5)}`);
    await fs.mkdir(uniqueDir, { recursive: true });
    const uniqueLocal = path.resolve(uniqueDir, path.basename(filename));

    try {
      const input = Buffer.isBuffer(data) ? Readable.from(data) : data;
      const output = createWriteStream(uniqueLocal);
      if (maxSize) {
        await IOUtil.streamWithMaxSize(input, output, maxSize);
      } else {
        await pipeline(input, output);
      }
    } catch (err) {
      await fs.rm(uniqueLocal, { force: true });
      throw err;
    }

    return uniqueLocal;
  }
}