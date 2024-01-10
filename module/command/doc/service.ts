import { createWriteStream, createReadStream } from 'node:fs';
import { CommandOperation } from '@travetto/command';

export class ImageCompressor {
  converter = new CommandOperation({
    containerImage: 'agregad/pngquant',
    localCheck: ['pngquant', ['-h']]
  });

  async compress(img: string) {
    const state = await this.converter.exec('pngquant', '--quality', '40-80', '--speed 1', '--force', '-');
    const out = `${img}.compressed`;

    // Feed into process
    createReadStream(img).pipe(state.stdin!);
    // Feed from process to file system
    state.stdout!.pipe(createWriteStream(out));

    await state.complete;
  }
}