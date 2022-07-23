import { createWriteStream, WriteStream } from 'fs';
import { LogLevel } from '@travetto/base';
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

  append(level: LogLevel, message: string): void {
    this.stream.write(`${message}\n`);
  }
}