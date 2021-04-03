import * as fs from 'fs';
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
  stream: fs.WriteStream;

  constructor(opts: FileAppenderOpts) {
    this.stream = fs.createWriteStream(opts.file, {
      autoClose: true,
      flags: 'a'
    });
  }

  append(msg: string) {
    this.stream.write(`${msg}\n`);
  }
}