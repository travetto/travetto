import { FsUtil } from '@travetto/base';

export interface FileOutputOpts {
  file: string;
}

export function fileOutput(opts: FileOutputOpts) {
  const stream = FsUtil.createWriteStream(opts.file, {
    autoClose: true,
    flags: 'a'
  });

  return (msg: string) => stream.write(`${msg}\n`);
}