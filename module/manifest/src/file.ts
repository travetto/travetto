import os from 'os';
import fs from 'fs/promises';
import { readFileSync } from 'fs';

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
    fs.unlink(temp);
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

  /**
   * Stat file
   */
  static statFile(file: string): Promise<{ mtimeMs: number, ctimeMs: number } | undefined> {
    return fs.stat(file).catch(() => undefined);
  }
}