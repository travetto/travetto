import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

import { CommandOperation } from '@travetto/command';
import { ExecUtil } from '@travetto/base';

export class ImageCompressor {
  converter = new CommandOperation({
    containerImage: 'agregad/pngquant',
    localCheck: ['pngquant', ['-h']]
  });

  async compress(img: string) {
    const proc = await this.converter.exec('pngquant', '--quality', '40-80', '--speed 1', '--force', '-');
    const out = `${img}.compressed`;

    await Promise.all([
      // Feed into process
      pipeline(createReadStream(img), process.stdin),
      // Write output
      pipeline(proc.stdout!, createWriteStream(out))
    ]);

    await ExecUtil.getResult(proc);
  }
}