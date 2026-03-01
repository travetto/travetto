import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';

import path from './path.ts';

export class ManifestFileUtil {
  /**
   * Write file and copy over when ready
   */
  static async bufferedFileWrite(file: string, content: string): Promise<void> {
    const temp = path.resolve(os.tmpdir(), `${process.hrtime()[1]}.${path.basename(file)}`);
    try {
      await fs.writeFile(temp, content, 'utf8');
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.copyFile(temp, file);
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