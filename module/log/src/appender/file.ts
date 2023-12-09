import { createWriteStream, WriteStream, mkdirSync, openSync, appendFileSync } from 'node:fs';

import { Env } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { Config, EnvVar } from '@travetto/config';
import { ManifestFileUtil, path, RuntimeIndex } from '@travetto/manifest';

import { LogAppender, LogEvent } from '../types';

@Config('log')
export class FileLogAppenderConfig {
  @EnvVar(Env.TRV_LOG_OUTPUT.key)
  output?: 'file' | string;

  writeSync = false;

  postConstruct(): void {
    if (!this.output || this.output === 'file' || this.output === 'console') {
      this.output = ManifestFileUtil.toolPath(RuntimeIndex, 'output.log', true);
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