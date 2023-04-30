import { createWriteStream, WriteStream, mkdirSync } from 'fs';

import { Injectable } from '@travetto/di';
import { Config, EnvVar } from '@travetto/config';
import { path, RootIndex } from '@travetto/manifest';

import { LogAppender, LogEvent } from '../types';

@Config('log')
export class FileLogAppenderConfig {
  @EnvVar('TRV_LOG_OUTPUT')
  output?: 'file' | string;

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
  stream: WriteStream;

  constructor(opts: FileLogAppenderConfig) {
    mkdirSync(path.dirname(opts.output!), { recursive: true });
    this.stream = createWriteStream(opts.output!, { autoClose: true, flags: 'a' });
  }

  append(ev: LogEvent, formatted: string): void {
    this.stream.write(`${formatted}\n`);
  }
}