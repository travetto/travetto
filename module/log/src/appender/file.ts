import { createWriteStream, WriteStream } from 'fs';
import { Appender } from '../types';

/**
 * File appender options
 */
export interface FileAppenderOpts {
  file: string;
}

/**
 * File appender logger
 */
export class FileAppender implements Appender {
  stream: WriteStream;

  constructor(opts: FileAppenderOpts) {
    this.stream = createWriteStream(opts.file, {
      autoClose: true,
      flags: 'a'
    });
  }

  append(msg: string) {
    this.stream.write(`${msg}\n`);
  }
}