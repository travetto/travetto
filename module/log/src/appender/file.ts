import { createWriteStream, WriteStream } from 'fs';
import { Appender, LogEvent } from '../types';

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

  append(ev: LogEvent, formatted: string): void {
    this.stream.write(`${formatted}\n`);
  }
}