import * as fs from 'fs';
import { OutputHandler } from '../types';

/**
 * File output options
 */
export interface FileOutputOpts {
  file: string;
}

/**
 * File output logger
 */
export class FileOutput implements OutputHandler {
  stream: fs.WriteStream;

  constructor(private opts: FileOutputOpts) {
    this.stream = fs.createWriteStream(opts.file, {
      autoClose: true,
      flags: 'a'
    });
  }
  output(msg: string) {
    this.stream.write(`${msg}\n`);
  }
}