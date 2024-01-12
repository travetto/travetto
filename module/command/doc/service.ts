import { createWriteStream, createReadStream } from 'node:fs';

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

    // Feed into process
    createReadStream(img).pipe(proc.stdin!);
    // Feed from process to file system
    proc.stdout!.pipe(createWriteStream(out));

    await ExecUtil.getResult(proc);
  }
}