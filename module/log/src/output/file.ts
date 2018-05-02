import * as fs from 'fs';

export interface FileOutputOpts {
  file: string;
}

export function fileOutput(opts: FileOutputOpts) {
  const stream = fs.createWriteStream(opts.file, {
    autoClose: true,
    flags: 'a'
  });

  return (message: string) => {
    stream.write(`${message}\n`);
  }
}