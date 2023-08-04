import { createWriteStream, WriteStream, mkdirSync, openSync, appendFileSync } from 'fs';

import { Injectable } from '@travetto/di';
import { Config, EnvVar } from '@travetto/config';
import { path, RootIndex } from '@travetto/manifest';

import { LogAppender, LogEvent } from '../types';

@Config('log')
export class FileLogAppenderConfig {
  @EnvVar('TRV_LOG_OUTPUT')
  output?: 'file' | string;

  writeSync = false;

  postConstruct(): void {
    if (!this.output || this.output === 'file' || this.output === 'console') {
      this.output = path.resolve(RootIndex.manifest.toolFolder, 'logs', `${RootIndex.manifest.mainModule}.log`);
    }
  }
}

/**
 * File Logging Appender
 */
@Injectable()
export class FileLogAppender implements LogAppender {
  stream?: WriteStream;
  appendFd?: number;

  constructor(opts: FileLogAppenderConfig) {
    mkdirSync(path.dirname(opts.output!), { recursive: true });
    if (opts.writeSync) {
      this.appendFd = openSync(opts.output!, 'a');
    } else {
      this.stream = createWriteStream(opts.output!, { autoClose: true, flags: 'a' });
    }
  }

  append(ev: LogEvent, formatted: string): void {
    if (this.stream) {
      this.stream.write(`${formatted}\n`);
    } else {
      appendFileSync(this.appendFd!, `${formatted}\n`);
    }
  }
}