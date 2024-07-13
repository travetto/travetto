import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';

import { path } from './path';

export class ManifestFileUtil {
  /**
   * Write file and copy over when ready
   */
  static async bufferedFileWrite(file: string, content: string): Promise<void> {
    const temp = path.resolve(path.dirname(file), `.${process.hrtime()[0]}.${path.basename(file)}`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(temp, content, 'utf8');
    await fs.rename(temp, file);
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