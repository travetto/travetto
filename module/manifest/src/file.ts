import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';

import path from './path.ts';

export class ManifestFileUtil {
  /**
   * Write file and atomically rename over when ready
   */
  static async bufferedFileWrite(file: string, content: string): Promise<void> {
    const directory = path.dirname(file);
    await fs.mkdir(directory, { recursive: true });
    const temp = path.resolve(directory, `.${path.basename(file)}.${process.pid}.${process.hrtime.bigint()}.tmp`);
    try {
      await fs.writeFile(temp, content, 'utf8');
      await fs.rename(temp, file);
    } catch {
      const fallbackTemp = path.resolve(os.tmpdir(), `${process.pid}.${process.hrtime.bigint()}.${path.basename(file)}`);
      try {
        await fs.writeFile(fallbackTemp, content, 'utf8');
        await fs.copyFile(fallbackTemp, file);
      } finally {
        await fs.rm(fallbackTemp, { force: true });
      }
    } finally {
      await fs.rm(temp, { force: true });
    }
  }

  /**
   * Read as json, sync
   */
  static readAsJsonSync<T = unknown>(file: string): T {
    return JSON.parse(readFileSync(file, 'utf8'));
  }
}
