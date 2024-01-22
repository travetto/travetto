import os from 'node:os';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';

import { path } from './path';

export class ManifestFileUtil {
  /**
   * Write file and copy over when ready
   */
  static async bufferedFileWrite(file: string, content: string | object): Promise<string> {
    const ext = path.extname(file);
    const tempName = `${path.basename(file, ext)}.${process.ppid}.${process.pid}.${Date.now()}.${Math.random()}${ext}`;
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = path.resolve(os.tmpdir(), tempName);
    await fs.writeFile(temp, typeof content === 'string' ? content : JSON.stringify(content), 'utf8');
    await fs.copyFile(temp, file);
    fs.unlink(temp); // Don't wait for completion
    return file;
  }

  /**
   * Read as json
   */
  static async readAsJson<T = unknown>(file: string): Promise<T> {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  }

  /**
   * Read as json, sync
   */
  static readAsJsonSync<T = unknown>(file: string): T {
    return JSON.parse(readFileSync(file, 'utf8'));
  }
}