import path from 'path';
import fs from 'fs/promises';

import { StreamUtil } from '@travetto/base';

const size = (file: string): Promise<number> => fs.stat(file).then(stat => stat.size, () => -1);

export class FileUtil {

  /**
   * Watch lines for a given file, with automatic restart after completion by using watch
   * @param file
   * @returns
   */
  static async* watchLines(file: string, reset = false): AsyncIterable<string> {
    // Ensure file exists
    await fs.mkdir(path.dirname(file), { recursive: true });

    if (!await fs.stat(file).catch(() => false)) {
      await fs.appendFile(file, '', 'utf8');
    }

    if (reset) {
      await fs.truncate(file);
    }

    let offset = 0;

    async function* streamFile(): AsyncIterable<string> {
      for await (const { item, read } of StreamUtil.streamByDelimiter(file, { start: offset, delimiter: '\n' })) {
        offset = read;
        yield item;
      }
    }

    if (await size(file) < offset) { return; }

    yield* streamFile();
    for await (const _ of fs.watch(file, { persistent: true })) {
      if (await size(file) < offset) { return; }
      yield* streamFile();
    }
  }
}