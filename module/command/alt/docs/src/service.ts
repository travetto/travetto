import * as fs from 'fs';
import { CommandService } from '../../../src/command';

export class ImageCompressor {
  converter = new CommandService({
    containerImage: 'agregad/pngquant',
    localCheck: ['pngquant', ['-h']]
  });

  async compress(img: string) {
    const state = await this.converter.exec('pngquant', '--quality', '40-80', '--speed 1', '--force', '-');
    const out = `${img}.compressed`;

    // Feed into process
    fs.createReadStream(img).pipe(state.process.stdin!);
    // Feed from process to file system
    state.process.stdout!.pipe(fs.createWriteStream(out));

    await state.result;
  }
}